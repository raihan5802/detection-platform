import { useState, useCallback, useEffect, useRef } from 'react';
import { getDistance, reducePoints } from '../utils/geometryUtils';

/**
 * Custom hook to handle shape creation logic
 */
const useShapeCreation = ({
  selectedTool,
  activeLabel,
  activeLabelColor,
  pointsLimit,
  onFinishShape,
  addAnnotation,
  konvaImg,
  clipAnnotationToBoundary,
  setShowPointAdjuster, // For point adjustment panel
  onSelectAnnotation
}) => {
  // Unified drawing state
  const [drawingState, setDrawingState] = useState({
    // Common state
    isDrawing: false,
    currentShape: null,

    // Polygon/Polyline specific
    points: [],
    isDraggingWithCtrl: false, // Track if dragging with Ctrl is active
    lastDragPoint: null,

    // Ghost line cursor tracking
    lastMousePosition: null,

    // Point reduction panel
    showPointReductionPanel: false,
    distanceThreshold: 10,
    originalPoints: [],
    currentPoints: [],
    isShowingReducedPreview: false,
    currentAnnotationType: '',

    // Preview for vertex movement
    previewVertex: null,
  });

  // This effect makes sure that the drawing state is cleared when the tool changes
  useEffect(() => {
    // Reset drawing state when tool changes
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentShape: null,
      points: [],
      isDraggingWithCtrl: false,
      lastDragPoint: null,
      lastMousePosition: null,
      previewVertex: null,
    }));
  }, [selectedTool]);

  // Track the last used tool
  const lastToolRef = useRef(null);
  useEffect(() => {
    if (selectedTool !== 'move' && selectedTool !== 'select') {
      lastToolRef.current = selectedTool;
    }
  }, [selectedTool]);

  // Get the last used tool
  const getLastTool = useCallback(() => {
    return lastToolRef.current;
  }, []);

  // Check if points are close enough to snap
  const shouldSnapToFirst = useCallback((currentPoint, firstPoint, threshold = 15) => {
    const distance = getDistance(currentPoint, firstPoint);
    return distance <= threshold;
  }, []);

  // Set preview vertex state for live preview of vertex movement
  const setPreviewVertex = useCallback((annIndex, vertexIndex, point, initialPoint) => {
    setDrawingState(prev => ({
      ...prev,
      previewVertex: {
        annIndex,
        vertexIndex,
        point: point || initialPoint,
        initialPoint
      }
    }));
  }, []);

  // Clear preview vertex
  const clearPreviewVertex = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      previewVertex: null
    }));
  }, []);

  // Handle point reduction
  const handlePointReduction = useCallback((points, tool) => {
    if (!points || points.length < 3) return;

    setDrawingState(prev => ({
      ...prev,
      showPointReductionPanel: true,
      originalPoints: points,
      currentPoints: points,
      isShowingReducedPreview: false,
      currentAnnotationType: tool,
    }));
  }, []);

  // Handle point threshold change for reduction
  const handleThresholdChange = useCallback((e) => {
    const threshold = parseInt(e.target.value);

    const reducedPoints = reducePoints(drawingState.originalPoints, threshold);

    setDrawingState(prev => ({
      ...prev,
      distanceThreshold: threshold,
      currentPoints: reducedPoints,
      isShowingReducedPreview: true,
    }));
  }, [drawingState.originalPoints]);

  // Apply point reduction
  const applyPointReduction = useCallback(() => {
    if (!drawingState.currentPoints || drawingState.currentPoints.length < 3) {
      return cancelPointReduction();
    }

    const newAnnotation = {
      type: drawingState.currentAnnotationType,
      points: drawingState.currentPoints,
      label: activeLabel,
      color: activeLabelColor,
      opacity: 0.55,
    };

    const newIndex = addAnnotation(newAnnotation);

    setDrawingState(prev => ({
      ...prev,
      showPointReductionPanel: false,
      originalPoints: [],
      currentPoints: [],
      isShowingReducedPreview: false,
      currentAnnotationType: '',
    }));

    // Automatically show point adjuster after creation
    if (setShowPointAdjuster && newIndex !== undefined) {
      onSelectAnnotation?.(newIndex);
      setTimeout(() => setShowPointAdjuster(true), 100);
    }

    onFinishShape && onFinishShape();
  }, [
    drawingState.currentPoints,
    drawingState.currentAnnotationType,
    activeLabel,
    activeLabelColor,
    addAnnotation,
    onFinishShape,
    setShowPointAdjuster,
    onSelectAnnotation
  ]);

  // Cancel point reduction
  const cancelPointReduction = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      showPointReductionPanel: false,
      originalPoints: [],
      currentPoints: [],
      isShowingReducedPreview: false,
      currentAnnotationType: '',
    }));
  }, []);

  const finishDrawing = useCallback((tool) => {
    if (!drawingState.isDrawing) {
      console.log("Attempted to finish drawing, but isDrawing is false");
      return;
    }

    console.log("Finishing drawing with tool:", tool);
    console.log("Current drawing state:", drawingState);

    if (tool === 'bbox' && drawingState.currentShape?.type === 'bbox') {
      // Make sure the width and height are positive
      let { x, y, width, height } = drawingState.currentShape;
      if (width < 0) {
        x = x + width;
        width = Math.abs(width);
      }
      if (height < 0) {
        y = y + height;
        height = Math.abs(height);
      }

      const finalBbox = {
        ...drawingState.currentShape,
        x, y, width, height
      };

      // Only add if dimensions are significant
      if (width > 5 && height > 5) {
        console.log("Adding bbox annotation:", finalBbox);
        const newIndex = addAnnotation(finalBbox);
        // Auto-select the newly created annotation
        if (newIndex !== undefined) {
          onSelectAnnotation?.(newIndex);
        }
      } else {
        console.log("Bbox too small to add, min size is 5x5");
      }

      setDrawingState(prev => ({
        ...prev,
        isDrawing: false,
        currentShape: null,
      }));
      onFinishShape && onFinishShape();
    } else if (tool === 'ellipse' && drawingState.currentShape?.type === 'ellipse') {
      // Only add if dimensions are significant
      if (drawingState.currentShape.radiusX > 5 && drawingState.currentShape.radiusY > 5) {
        console.log("Adding ellipse annotation:", drawingState.currentShape);
        const newIndex = addAnnotation(drawingState.currentShape);
        // Auto-select the newly created annotation
        if (newIndex !== undefined) {
          onSelectAnnotation?.(newIndex);
        }
      } else {
        console.log("Ellipse too small to add, min radius is 5");
      }

      setDrawingState(prev => ({
        ...prev,
        isDrawing: false,
        currentShape: null,
      }));
      onFinishShape && onFinishShape();
    } else if (tool === 'polygon') {
      if (drawingState.points.length >= 3) {
        // Check if last point is close to first point and snap if needed
        let finalPoints = [...drawingState.points];
        const firstPoint = finalPoints[0];
        const lastPoint = finalPoints[finalPoints.length - 1];

        if (shouldSnapToFirst(lastPoint, firstPoint)) {
          finalPoints = [...finalPoints.slice(0, -1), { ...firstPoint }];
        }

        // Directly finish polygon without point reduction
        const newAnnotation = {
          type: 'polygon',
          points: finalPoints,
          label: activeLabel,
          color: activeLabelColor,
          opacity: 0.55,
        };

        console.log("Adding polygon annotation:", newAnnotation);
        const newIndex = addAnnotation(newAnnotation);
        setDrawingState(prev => ({
          ...prev,
          isDrawing: false,
          points: [],
          isDraggingWithCtrl: false,
          lastDragPoint: null,
        }));

        // Auto-select and show point adjuster
        // maybe comment this if block
        // if (newIndex !== undefined) {
        //   onSelectAnnotation?.(newIndex);
        //   // Show point adjuster right after creating a polygon
        //   if (setShowPointAdjuster) {
        //     setTimeout(() => setShowPointAdjuster(true), 100);
        //   }
        // }

        onFinishShape && onFinishShape();
      } else {
        console.log("Not enough points for polygon, minimum is 3");
      }
    } else if (tool === 'polyline') {
      if (drawingState.points.length >= 2) {
        // Directly finish polyline
        const newAnnotation = {
          type: 'polyline',
          points: drawingState.points,
          label: activeLabel,
          color: activeLabelColor,
          opacity: 0.55,
        };

        console.log("Adding polyline annotation:", newAnnotation);
        const newIndex = addAnnotation(newAnnotation);
        setDrawingState(prev => ({
          ...prev,
          isDrawing: false,
          points: [],
          isDraggingWithCtrl: false,
          lastDragPoint: null,
        }));

        // Auto-select the newly created annotation
        if (newIndex !== undefined) {
          onSelectAnnotation?.(newIndex);
        }

        onFinishShape && onFinishShape();
      } else {
        console.log("Not enough points for polyline, minimum is 2");
      }
    }
  }, [
    drawingState,
    activeLabel,
    activeLabelColor,
    addAnnotation,
    onFinishShape,
    shouldSnapToFirst,
    setShowPointAdjuster,
    onSelectAnnotation
  ]);

  // Start drawing a shape
  const startDrawing = useCallback((pos, tool, isCtrlPressed, forceToolOverride = false) => {
    console.log("startDrawing called with:", {
      pos,
      tool,
      isCtrlPressed,
      forceToolOverride,
      selectedTool,
      currentShapeType: drawingState.currentShape?.type,
      isDrawing: drawingState.isDrawing
    });

    // For double-click functionality, we may want to create a shape with a different tool
    // than the currently selected one. This is controlled by forceToolOverride.
    const effectiveTool = forceToolOverride ? tool : selectedTool;

    // If we're already drawing a polygon/polyline, add a point instead of starting a new one
    if (drawingState.isDrawing && (effectiveTool === 'polygon' || effectiveTool === 'polyline')) {
      console.log("Adding point to existing polygon/polyline");

      // Check if clicking near the first point to close the polygon
      if (drawingState.points.length >= 2 && effectiveTool === 'polygon') {
        const firstPoint = drawingState.points[0];
        const distToFirst = Math.sqrt(
          Math.pow(pos.x - firstPoint.x, 2) +
          Math.pow(pos.y - firstPoint.y, 2)
        );

        // If clicking close to first point, close the polygon
        if (distToFirst < 15 / (window.scale || 1)) { // Use global scale if available
          console.log("Close to first point, finishing polygon");
          finishDrawing('polygon');
          return;
        }
      }

      // Adding a point to existing polygon/polyline
      const newPoints = [...drawingState.points, pos];
      setDrawingState(prev => ({
        ...prev,
        points: newPoints,
        lastMousePosition: pos,
      }));

      // Auto-finish if we hit the points limit
      if (pointsLimit > 0 && newPoints.length === pointsLimit) {
        console.log("Reached points limit, auto-finishing");
        setTimeout(() => finishDrawing(effectiveTool), 0);
      }

      return;
    }

    // If we reached here, we're starting a new shape
    console.log("Starting a new shape with tool:", effectiveTool);

    if (effectiveTool === 'bbox') {
      console.log("Creating new bbox at position:", pos);
      setDrawingState({
        isDrawing: true,
        currentShape: {
          type: 'bbox',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          label: activeLabel,
          color: activeLabelColor,
          opacity: 0.55,
        },
        points: [],
        isDraggingWithCtrl: false,
        lastDragPoint: null,
        lastMousePosition: pos,
        showPointReductionPanel: false,
        distanceThreshold: 10,
        originalPoints: [],
        currentPoints: [],
        isShowingReducedPreview: false,
        currentAnnotationType: '',
        previewVertex: null,
      });
    } else if (effectiveTool === 'ellipse') {
      console.log("Creating new ellipse at position:", pos);
      setDrawingState({
        isDrawing: true,
        currentShape: {
          type: 'ellipse',
          x: pos.x,
          y: pos.y,
          radiusX: 0,
          radiusY: 0,
          rotation: 0,
          label: activeLabel,
          color: activeLabelColor,
          opacity: 0.55,
        },
        points: [],
        isDraggingWithCtrl: false,
        lastDragPoint: null,
        lastMousePosition: pos,
        showPointReductionPanel: false,
        distanceThreshold: 10,
        originalPoints: [],
        currentPoints: [],
        isShowingReducedPreview: false,
        currentAnnotationType: '',
        previewVertex: null,
      });
    } else if (effectiveTool === 'polygon') {
      console.log("Starting new polygon at position:", pos);
      setDrawingState({
        isDrawing: true,
        currentShape: null,
        points: [pos],
        isDraggingWithCtrl: isCtrlPressed,
        lastDragPoint: isCtrlPressed ? pos : null,
        lastMousePosition: pos,
        showPointReductionPanel: false,
        distanceThreshold: 10,
        originalPoints: [],
        currentPoints: [],
        isShowingReducedPreview: false,
        currentAnnotationType: '',
        previewVertex: null,
      });
    } else if (effectiveTool === 'polyline') {
      console.log("Starting new polyline at position:", pos);
      setDrawingState({
        isDrawing: true,
        currentShape: null,
        points: [pos],
        isDraggingWithCtrl: isCtrlPressed,
        lastDragPoint: isCtrlPressed ? pos : null,
        lastMousePosition: pos,
        showPointReductionPanel: false,
        distanceThreshold: 10,
        originalPoints: [],
        currentPoints: [],
        isShowingReducedPreview: false,
        currentAnnotationType: '',
        previewVertex: null,
      });
    }
  }, [
    drawingState,
    activeLabel,
    activeLabelColor,
    pointsLimit,
    selectedTool,
    finishDrawing
  ]);

  // Update the current drawing shape
  const updateDrawing = useCallback((pos, tool) => {
    // Update the last mouse position for ghost line
    if (drawingState.isDrawing) {
      setDrawingState(prev => ({
        ...prev,
        lastMousePosition: pos
      }));
    }

    // Special case for double-click functionality - allow updating with a forced tool
    const effectiveTool = tool === drawingState.currentShape?.type ? tool :
      (drawingState.currentShape?.type || tool);

    if (effectiveTool === 'bbox' && drawingState.currentShape?.type === 'bbox') {
      setDrawingState(prev => ({
        ...prev,
        currentShape: {
          ...prev.currentShape,
          width: pos.x - prev.currentShape.x,
          height: pos.y - prev.currentShape.y,
        },
      }));
    } else if (effectiveTool === 'ellipse' && drawingState.currentShape?.type === 'ellipse') {
      setDrawingState(prev => ({
        ...prev,
        currentShape: {
          ...prev.currentShape,
          radiusX: Math.abs(pos.x - prev.currentShape.x),
          radiusY: Math.abs(pos.y - prev.currentShape.y),
        },
      }));
    }

    // Handle Ctrl+drag for continuous drawing
    if (drawingState.isDraggingWithCtrl && drawingState.lastDragPoint) {
      const minDistanceBetweenPoints = 5; // Reduced from 10 for smoother curves
      const distance = getDistance(drawingState.lastDragPoint, pos);

      if (distance >= minDistanceBetweenPoints) {
        if ((effectiveTool === 'polygon' || (drawingState.points.length > 0 && drawingState.isDrawing)) &&
          drawingState.isDrawing) {
          // Check point limit before adding
          if (pointsLimit === 0 || drawingState.points.length < pointsLimit) {
            setDrawingState(prev => ({
              ...prev,
              points: [...prev.points, pos],
              lastDragPoint: pos,
              lastMousePosition: pos,
            }));
          } else if (drawingState.points.length >= pointsLimit) {
            finishDrawing('polygon');
          }
        } else if ((effectiveTool === 'polyline' || (drawingState.points.length > 0 && drawingState.isDrawing)) &&
          drawingState.isDrawing) {
          // Similar for polyline
          if (pointsLimit === 0 || drawingState.points.length < pointsLimit) {
            setDrawingState(prev => ({
              ...prev,
              points: [...prev.points, pos],
              lastDragPoint: pos,
              lastMousePosition: pos,
            }));
          } else if (drawingState.points.length >= pointsLimit) {
            finishDrawing('polyline');
          }
        }
      }
    }
  }, [drawingState, pointsLimit, finishDrawing]);

  // Enable Ctrl+drag during polygon drawing at any time
  const enableCtrlDrag = useCallback((pos) => {
    if (!drawingState.isDrawing ||
      !(selectedTool === 'polygon' || selectedTool === 'polyline' ||
        drawingState.points.length > 0)) {
      return false;
    }

    // Set drawing state to enable Ctrl-drag mode
    setDrawingState(prev => ({
      ...prev,
      isDraggingWithCtrl: true,
      lastDragPoint: pos || prev.lastMousePosition,
    }));

    return true;
  }, [drawingState, selectedTool]);

  // Disable Ctrl+drag
  const disableCtrlDrag = useCallback(() => {
    if (!drawingState.isDraggingWithCtrl) return false;

    setDrawingState(prev => ({
      ...prev,
      isDraggingWithCtrl: false,
      lastDragPoint: null,
    }));

    // Auto-finish polygon/polyline when releasing Ctrl
    if (drawingState.points.length >= 3 &&
      (selectedTool === 'polygon' || drawingState.points.length > 0)) {
      finishDrawing('polygon');
      return true;
    } else if (drawingState.points.length >= 2 &&
      (selectedTool === 'polyline' || drawingState.points.length > 0)) {
      finishDrawing('polyline');
      return true;
    }

    return false;
  }, [drawingState, selectedTool, finishDrawing]);

  // Remove the last point while drawing (for right-click or backspace)
  const removeLastPoint = useCallback(() => {
    if (!drawingState.isDrawing) return;

    if ((selectedTool === 'polygon' || selectedTool === 'polyline' || drawingState.points.length > 0) &&
      drawingState.points.length > 0) {
      setDrawingState(prev => ({
        ...prev,
        points: prev.points.slice(0, -1)
      }));
    }
  }, [drawingState, selectedTool]);

  // Cancel the current drawing
  const cancelDrawing = useCallback(() => {
    console.log("Canceling drawing");
    setDrawingState({
      isDrawing: false,
      currentShape: null,
      points: [],
      isDraggingWithCtrl: false,
      lastDragPoint: null,
      lastMousePosition: null,
      showPointReductionPanel: false,
      distanceThreshold: 10,
      originalPoints: [],
      currentPoints: [],
      isShowingReducedPreview: false,
      currentAnnotationType: '',
      previewVertex: null,
    });
  }, []);

  return {
    drawingState,
    setDrawingState,
    startDrawing,
    updateDrawing,
    enableCtrlDrag,
    disableCtrlDrag,
    finishDrawing,
    cancelDrawing,
    removeLastPoint,
    getLastTool,
    setPreviewVertex,
    clearPreviewVertex,
    handleThresholdChange,
    applyPointReduction,
    cancelPointReduction,
  };
};

export default useShapeCreation;