import { useState, useCallback, useRef, useEffect } from 'react';
import { throttle } from 'lodash';

/**
 * Custom hook to handle canvas interactions (mouse/touch events)
 */
const useCanvasInteractions = ({
  stageRef,
  selectedTool,
  drawingState,
  setDrawingState,
  startDrawing,
  updateDrawing,
  finishDrawing,
  removeLastPoint,
  enableCtrlDrag,
  disableCtrlDrag,
  selectedAnnotationIndex,
  selectedAnnotationIndices,
  setSelectedAnnotationIndex,
  toggleMultiSelect,
  selectMultipleAnnotations,
  scale,
  annotations,
  isPointInPolygon,
  findShapesInRegion,
  saveImagePosition,
}) => {
  // Canvas group position for panning
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  
  // Track right mouse button state for right+left click combination
  const rightMouseDownRef = useRef(false);
  const rightMouseDownTimeRef = useRef(0);
  
  // Track if gesture is in progress for trackpad detection
  const isGestureInProgressRef = useRef(false);
  
  // Track mouse position for move updates
  const lastMousePosRef = useRef(null);
  
  // Track if we're near a vertex while drawing for possible deletion
  const hoverVertexIndexRef = useRef(-1);

  // Selection marquee state
  const [selectionMarquee, setSelectionMarquee] = useState({
    visible: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  
  // Track if we're dragging a selection marquee
  const isDraggingMarqueeRef = useRef(false);

  // Track if Ctrl key is pressed for hybrid polygon drawing mode
  const isCtrlPressedRef = useRef(false);

  // Helper to get mouse position relative to the annotation group
  const getGroupPos = useCallback((evt) => {
    const group = stageRef.current?.findOne('#anno-group');
    return group ? group.getRelativePointerPosition() : null;
  }, [stageRef]);
  
  // Check if mouse is near a point in the current drawing
  const getNearestVertexIndex = useCallback((pos, threshold = 10) => {
    if (!drawingState.points || drawingState.points.length === 0) return -1;
    
    let minDist = Number.MAX_VALUE;
    let nearestIdx = -1;
    
    drawingState.points.forEach((pt, idx) => {
      const dx = pt.x - pos.x;
      const dy = pt.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < threshold / scale && dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });
    
    return nearestIdx;
  }, [drawingState.points, scale]);

  // Listen for Ctrl key press/release for hybrid polygon drawing mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Control' || e.key === 'Meta') && 
          drawingState.isDrawing && 
          (selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0)) {
        isCtrlPressedRef.current = true;
        
        // If not already in Ctrl+drag mode, enable it
        if (!drawingState.isDraggingWithCtrl && lastMousePosRef.current) {
          enableCtrlDrag(lastMousePosRef.current);
        }
      }
    };

    const handleKeyUp = (e) => {
      if ((e.key === 'Control' || e.key === 'Meta')) {
        isCtrlPressedRef.current = false;
        
        // Disable Ctrl+drag mode if it was active
        if (drawingState.isDraggingWithCtrl) {
          disableCtrlDrag();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [drawingState, selectedTool, enableCtrlDrag, disableCtrlDrag]);

  // Handle mouse down event
  const handleMouseDown = useCallback((evt) => {
    console.log("Mouse down event:", evt.evt.button, "Selected tool:", selectedTool);
    
    // Store the mouse position for potential use in move updates
    const pos = getGroupPos(evt);
    if (!pos) return;
    
    lastMousePosRef.current = pos;
    
    // Track right mouse button state
    if (evt.evt.button === 2) {
      rightMouseDownRef.current = true;
      rightMouseDownTimeRef.current = Date.now();
      
      // Don't remove point when right-clicking
      evt.evt.preventDefault();
      return;
    }
    
    // If right button is down and left button is clicked, finish polygon
    if (evt.evt.button === 0 && rightMouseDownRef.current) {
      if (Date.now() - rightMouseDownTimeRef.current < 300) {
        if ((selectedTool === 'polygon' || drawingState.points.length > 0) && 
            drawingState.isDrawing && drawingState.points.length >= 3) {
          finishDrawing('polygon');
          evt.evt.preventDefault();
          return;
        } else if ((selectedTool === 'polyline' || drawingState.points.length > 0) && 
                  drawingState.isDrawing && drawingState.points.length >= 2) {
          finishDrawing('polyline');
          evt.evt.preventDefault();
          return;
        }
      }
    }
    
    // Handle selection behavior (always available in move tool)
    if (selectedTool === 'move' && evt.target.name() !== 'vertex') {
      // If not holding shift key, clear the current selection
      if (!evt.evt.shiftKey && evt.target.name() === 'background-image') {
        setSelectedAnnotationIndex(null);
      }
      
      // Start selection marquee if we're on the background or if shift is held
      if (evt.target.name() === 'background-image' || evt.evt.shiftKey) {
        isDraggingMarqueeRef.current = true;
        
        setSelectionMarquee({
          visible: true,
          startX: pos.x,
          startY: pos.y,
          endX: pos.x,
          endY: pos.y,
        });
        
        // Change cursor to crosshair during selection
        document.body.style.cursor = 'crosshair';
        
        // Cancel bubbling to prevent other handlers
        evt.cancelBubble = true;
        return;
      }
    }
    
    // Check if we're already drawing - if so, we might be continuing a polygon
    if (drawingState.isDrawing && (selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0)) {
      // Check if clicking near the first point to close the polygon
      if (drawingState.points.length >= 2 && 
          (selectedTool === 'polygon' || drawingState.points.length > 0)) {
        const firstPoint = drawingState.points[0];
        const distToFirst = Math.sqrt(
          Math.pow(pos.x - firstPoint.x, 2) + 
          Math.pow(pos.y - firstPoint.y, 2)
        );
        
        if (distToFirst < 15 / scale) {
          finishDrawing('polygon');
          evt.evt.preventDefault();
          return;
        }
      }
      
      // If we're already drawing a polygon/polyline, add a new point
      if (evt.evt.button === 0 && 
          (selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0)) {
        console.log("Adding point to existing shape");
        setDrawingState(prev => ({
          ...prev,
          points: [...prev.points, pos],
          lastMousePosition: pos,
        }));
        evt.evt.preventDefault();
        return;
      }
    }
    
    // Only start drawing if we're in drawing mode and not clicking on an existing shape
    if ((selectedTool !== 'move') && evt.target.name() !== 'vertex') {
      const isCtrlPressed = evt.evt.ctrlKey || evt.evt.metaKey;
      isCtrlPressedRef.current = isCtrlPressed;
      
      // Left-click only for drawing
      if (evt.evt.button === 0) {
        startDrawing(pos, selectedTool, isCtrlPressed);
      }
    }
  }, [
    selectedTool, 
    getGroupPos, 
    startDrawing, 
    setSelectedAnnotationIndex, 
    drawingState, 
    finishDrawing, 
    scale
  ]);

  // Throttled mouse move handler for better performance
  const handleMouseMove = useCallback(
    throttle((evt) => {
      const pos = getGroupPos(evt);
      if (!pos) return;
      
      // Store current position
      lastMousePosRef.current = pos;
      
      // Update selection marquee if dragging
      if (isDraggingMarqueeRef.current && selectedTool === 'move') {
        document.body.style.cursor = 'crosshair';
        
        setSelectionMarquee(prev => ({
          ...prev,
          endX: pos.x,
          endY: pos.y,
          visible: true // Ensure it's visible
        }));
        return;
      }
      
      // When drawing polygons/polylines, check if near a vertex for possible deletion
      if (drawingState.isDrawing && 
          (selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0)) {
        hoverVertexIndexRef.current = getNearestVertexIndex(pos);
        
        // Change cursor if hovering over a vertex
        if (hoverVertexIndexRef.current >= 0) {
          document.body.style.cursor = 'pointer';
        } else if (document.body.style.cursor === 'pointer') {
          document.body.style.cursor = '';
        }
        
        // Check if mouse is near the first point to show "close" cursor
        if (drawingState.points.length >= 2) {
          const firstPoint = drawingState.points[0];
          const distToFirst = Math.sqrt(
            Math.pow(pos.x - firstPoint.x, 2) + 
            Math.pow(pos.y - firstPoint.y, 2)
          );
          
          if (distToFirst < 15 / scale) {
            document.body.style.cursor = 'crosshair';
          }
        }
      }
      
      // Update drawing if in progress
      if (drawingState.isDrawing) {
        updateDrawing(pos, selectedTool);
        
        // If Ctrl key is being held and we're not already in Ctrl+drag mode for polyline/polygon
        if ((selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0) &&
            isCtrlPressedRef.current && 
            !drawingState.isDraggingWithCtrl) {
          enableCtrlDrag(pos);
        }
      }
    }, 10), // ~100fps for smoother operation
    [
      drawingState, 
      selectedTool, 
      getGroupPos, 
      updateDrawing, 
      getNearestVertexIndex, 
      scale, 
      enableCtrlDrag
    ]
  );

  // Handle mouse up event
  const handleMouseUp = useCallback((evt) => {
    // Reset right mouse button state
    if (evt.evt.button === 2) {
      rightMouseDownRef.current = false;
    }
    
    // If we're dragging a selection marquee, finish it
    if (isDraggingMarqueeRef.current && selectedTool === 'move') {
      isDraggingMarqueeRef.current = false;
      
      // Reset cursor
      document.body.style.cursor = '';
      
      // Find shapes that intersect with the marquee
      if (selectionMarquee.visible) {
        const marqueeRegion = {
          x1: Math.min(selectionMarquee.startX, selectionMarquee.endX),
          y1: Math.min(selectionMarquee.startY, selectionMarquee.endY),
          x2: Math.max(selectionMarquee.startX, selectionMarquee.endX),
          y2: Math.max(selectionMarquee.startY, selectionMarquee.endY),
        };
        
        // Only select if the marquee has some minimum size (at least 3px in either direction)
        if (Math.abs(marqueeRegion.x2 - marqueeRegion.x1) > 3 && 
            Math.abs(marqueeRegion.y2 - marqueeRegion.y1) > 3) {
          
          // Find all annotations within the selection marquee
          const selectedIndices = findShapesInRegion(annotations, marqueeRegion);
          
          // Update selection immediately
          if (evt.evt.shiftKey) {
            // Add to existing selection if shift key is pressed
            selectMultipleAnnotations(selectedIndices, true);
          } else {
            // Replace selection otherwise
            selectMultipleAnnotations(selectedIndices, false);
          }
        }
      }
      
      // Hide the marquee
      setSelectionMarquee(prev => ({ ...prev, visible: false }));
      return;
    }

    // For left mouse button only
    if (evt.evt.button === 0) {
      // Handle Ctrl key release for polygon/polyline drawing
      if (drawingState.isDrawing && 
         (selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0)) {
        if (isCtrlPressedRef.current) {
          isCtrlPressedRef.current = false;
        }
        
        // If Ctrl+drag was active and we're releasing the mouse, auto-finish if we have enough points
        if (drawingState.isDraggingWithCtrl) {
          disableCtrlDrag();
        }
      }
      
      // Finish bbox or ellipse drawing
      if (drawingState.isDrawing) {
        if ((selectedTool === 'bbox' || drawingState.currentShape?.type === 'bbox') && 
            drawingState.currentShape?.type === 'bbox') {
          finishDrawing('bbox');
        } else if ((selectedTool === 'ellipse' || drawingState.currentShape?.type === 'ellipse') && 
                  drawingState.currentShape?.type === 'ellipse') {
          finishDrawing('ellipse');
        }
      }
    }
  }, [
    selectedTool, 
    drawingState, 
    finishDrawing, 
    selectionMarquee, 
    findShapesInRegion, 
    annotations, 
    selectMultipleAnnotations,
    disableCtrlDrag
  ]);

  // Handle double click event
  const handleDblClick = useCallback((evt) => {
    evt.cancelBubble = true;
    // Double-click handled in the main component
  }, []);

  // Handle right-click (context menu)
  const handleContextMenu = useCallback((evt) => {
    evt.evt.preventDefault();
    evt.cancelBubble = true;
    
    // If we're drawing a polygon/polyline, remove the last point
    if (drawingState.isDrawing && 
        (selectedTool === 'polygon' || selectedTool === 'polyline') && 
        drawingState.points.length > 0) {
      removeLastPoint();
    }
  }, [drawingState, selectedTool, removeLastPoint]);
  
  // Handle wheel event for zooming - updated to not require Ctrl and fix direction
  const handleWheel = useCallback((evt) => {
    evt.evt.preventDefault();
    
    // Detect if this is a trackpad gesture (pinch to zoom)
    const isGesture = evt.evt.ctrlKey || 
                   (typeof evt.evt.deltaZ === 'number' && evt.evt.deltaZ !== 0) ||
                   (Math.abs(evt.evt.deltaX) > 0 && Math.abs(evt.evt.deltaY) > 0);
                   
    if (isGesture) {
      isGestureInProgressRef.current = true;
      
      // Handle pinch-zoom
      if (evt.evt.ctrlKey || (evt.evt.deltaY !== 0 && Math.abs(evt.evt.deltaY) > Math.abs(evt.evt.deltaX))) {
        // Positive deltaY = zoom out, negative = zoom in (natural direction)
        return { action: 'zoom', delta: evt.evt.deltaY };
      }
      
      // Handle two-finger pan
      if (Math.abs(evt.evt.deltaX) > Math.abs(evt.evt.deltaY)) {
        setImagePos(prev => ({ x: prev.x - evt.evt.deltaX / scale, y: prev.y }));
      } else {
        setImagePos(prev => ({ x: prev.x, y: prev.y - evt.evt.deltaY / scale }));
      }
    } else {
      // Regular mouse wheel - use for zooming (no Ctrl key needed)
      isGestureInProgressRef.current = false;
      
      // Positive deltaY = zoom out, negative = zoom in (natural direction)
      return { action: 'zoom', delta: evt.evt.deltaY };
    }
    
    return null;
  }, [scale]);

  return {
    imagePos,
    setImagePos,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDblClick,
    handleContextMenu,
    handleWheel,
    selectionMarquee,
    setSelectionMarquee,
    getGroupPos,
  };
};

export default useCanvasInteractions;