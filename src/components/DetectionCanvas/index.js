import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import PointReductionPanel from './PointReductionPanel';
import PolygonPointAdjuster from './PolygonPointAdjuster';
import ShapeRenderer from './ShapeRenderer';
import AnnotationCreator from './AnnotationCreator';
import useAnnotationState from './hooks/useAnnotationState';
import useShapeCreation from './hooks/useShapeCreation';
import useCanvasInteractions from './hooks/useCanvasInteractions';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useTransformer from './hooks/useTransformer';
import { clipAnnotationToBoundary } from './utils/clippingUtils';
import { isPointInPolygon, findShapesInRegion } from './utils/shapeUtils';
import './styles.css';

const DetectionCanvas = ({
  fileUrl,
  annotations,
  onAnnotationsChange,
  selectedTool,
  dispatchToolAction,
  scale,
  onWheelZoom,
  activeLabelColor,
  labelClasses,
  onFinishShape,
  onDeleteAnnotation,
  onDblClick,
  activeLabel,
  pointsLimit,
  initialPosition,
  externalSelectedIndex,
  onSelectAnnotation,
  showLabels = false,
}) => {
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  // Basic state
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [konvaImg, setKonvaImg] = useState(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isOverVertex, setIsOverVertex] = useState(false);
  const [isOverAnnotation, setIsOverAnnotation] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showPointAdjuster, setShowPointAdjuster] = useState(false);

  // Use a ref to keep track of which shape is currently being hovered
  const hoveredShapeRef = useRef(null);

  // Effective tool state for internal tool management
  const [effectiveTool, setEffectiveTool] = useState(selectedTool);

  // Sync effectiveTool with selectedTool when selectedTool changes
  useEffect(() => {
    setEffectiveTool(selectedTool);
  }, [selectedTool]);

  // Image position state
  const [imagePos, setImagePos] = useState(initialPosition || { x: 0, y: 0 });
  // Store initial position for dragging
  const [dragStartPos, setDragStartPos] = useState(null);

  // Custom hooks for state management
  const {
    currentShapes,
    selectedAnnotationIndex,
    selectedAnnotationIndices,
    setSelectedAnnotationIndex,
    toggleMultiSelect,
    selectMultipleAnnotations,
    addAnnotation,
    addAnnotations,
    updateAnnotation,
    updateMultipleAnnotations,
    moveMultipleAnnotations,
    deleteAnnotation,
    deleteMultipleAnnotations,
    copySelectedAnnotations,
    pasteAnnotations,
    saveImagePosition,
    undo,
    redo,
    canUndo,
    canRedo,
    findShapesInRegion: findShapesInRegionHook,
  } = useAnnotationState({
    initialAnnotations: annotations,
    onAnnotationsChange,
    externalSelectedIndex,
    onSelectAnnotation,
    konvaImg,
    imagePos,
    setImagePos,
  });

  // Handle the onFinishShape event wrapper
  const handleFinishShape = useCallback(() => {
    // Call the original onFinishShape if provided
    if (onFinishShape) {
      onFinishShape();
    }
  }, [onFinishShape]);

  // Custom hook for shape creation
  const {
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
  } = useShapeCreation({
    selectedTool: effectiveTool,
    activeLabel,
    activeLabelColor,
    pointsLimit,
    onFinishShape: handleFinishShape,
    addAnnotation,
    konvaImg,
    clipAnnotationToBoundary,
    setShowPointAdjuster,
    onSelectAnnotation,
  });

  // Transformer hook for resizing/moving shapes
  const {
    transformerRef,
    shapeRefs,
    handleTransformEnd,
    resetRefs
  } = useTransformer({
    selectedAnnotationIndex,
    selectedAnnotationIndices,
    annotations: currentShapes,
    updateAnnotation,
    updateMultipleAnnotations,
    konvaImg,
    clipAnnotationToBoundary,
    selectedTool: effectiveTool
  });

  // Canvas interactions
  const {
    imagePos: canvasImagePos,
    setImagePos: setCanvasImagePos,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleWheel,
    selectionMarquee,
    setSelectionMarquee,
    getGroupPos,
  } = useCanvasInteractions({
    stageRef,
    selectedTool: effectiveTool,
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
    annotations: currentShapes,
    isPointInPolygon,
    findShapesInRegion: findShapesInRegionHook,
    saveImagePosition,
  });

  // Synchronize canvas image position with component state
  useEffect(() => {
    setImagePos(canvasImagePos);
  }, [canvasImagePos]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    cancelDrawing,
    deleteAnnotation,
    deleteMultipleAnnotations,
    copySelectedAnnotations,
    pasteAnnotations,
    selectedAnnotationIndex,
    selectedAnnotationIndices,
    removeLastPoint,
    drawingState,
    setDrawingState,
    undo,
    redo,
    dispatchToolAction,
    annotations: currentShapes,
    selectMultipleAnnotations
  });

  // Reset shape refs when image changes or annotations change significantly
  useEffect(() => {
    resetRefs();
  }, [fileUrl, resetRefs]);

  // Ensure transformer is cleared when switching tools
  useEffect(() => {
    if (effectiveTool !== 'move' && transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [effectiveTool]);

  // Fix for spacebar to finish polygon
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle key events if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Space bar or Enter key to finish polygons
      if ((e.key === ' ' || e.key === 'Enter') && drawingState.isDrawing) {
        console.log('Space or Enter pressed while drawing');

        if ((effectiveTool === 'polygon' || drawingState.points.length >= 3) &&
          drawingState.points.length >= 3) {
          console.log('Finishing polygon with space/enter');
          e.preventDefault();
          finishDrawing('polygon');
        } else if ((effectiveTool === 'polyline' || drawingState.points.length >= 2) &&
          drawingState.points.length >= 2) {
          console.log('Finishing polyline with space/enter');
          e.preventDefault();
          finishDrawing('polyline');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingState, effectiveTool, finishDrawing]);

  // Force recalculate position of point adjuster when zoom or position changes
  useEffect(() => {
    if (showPointAdjuster && selectedAnnotationIndex !== null) {
      const timer = setTimeout(() => {
        setShowPointAdjuster(false);
        setTimeout(() => {
          setShowPointAdjuster(true);
        }, 10);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scale, imagePos, selectedAnnotationIndex]);

  // Make sure the tools are properly reset when switching modes
  useEffect(() => {
    if (effectiveTool === 'move') {
      // Cancel any ongoing drawing when switching to move
      if (drawingState.isDrawing) {
        cancelDrawing();
      }
    }
  }, [effectiveTool, cancelDrawing, drawingState.isDrawing]);

  // Track cursor position for hit detection
  const handleMouseMoveStage = (evt) => {
    // Get pointer position relative to the annotation group
    const stage = evt.target.getStage(); // Get the stage regardless of target
    if (!stage) return handleMouseMove(evt);

    const pointer = stage.getPointerPosition();
    if (pointer) {
      const annoGroup = stage.findOne('#anno-group');
      if (annoGroup) {
        const transform = annoGroup.getAbsoluteTransform().copy().invert();
        const pos = transform.point(pointer);
        setCursorPosition(pos);
      }
    }

    // Call the regular mouse move handler
    handleMouseMove(evt);
  };

  // Handle right-click for polygon/polyline point removal
  const handleCustomContextMenu = (e) => {
    if (!drawingState.isDrawing) {
      // Normal context menu handler
      handleContextMenu(e);
      return;
    }

    e.evt.preventDefault();
    e.cancelBubble = true;

    // If we're drawing a polygon/polyline, remove the last point
    if ((effectiveTool === 'polygon' || effectiveTool === 'polyline') &&
      drawingState.points.length > 0) {
      removeLastPoint();
    }
  };

  // Load image
  useEffect(() => {
    if (fileUrl) {
      const img = new window.Image();
      img.src = fileUrl;
      img.onload = () => {
        setKonvaImg(img);
        setImgDims({ width: img.width, height: img.height });
        setImageLoaded(true);
        if (containerRef.current) {
          const canvasWidth = containerRef.current.offsetWidth;
          const canvasHeight = containerRef.current.offsetHeight;
          const xPos = Math.max(0, (canvasWidth - img.width) / 2);
          const yPos = Math.max(0, (canvasHeight - img.height) / 2);
          setImagePos({ x: xPos, y: yPos });
          setCanvasImagePos({ x: xPos, y: yPos });
        }
      };
    }
  }, [fileUrl]);

  useEffect(() => {
    if (initialPosition) {
      setImagePos(initialPosition);
      setCanvasImagePos(initialPosition);
    }
  }, [initialPosition]);

  // Handle canvas drag start - save current position for undo
  const handleDragStart = (e) => {
    setDragStartPos({ x: e.target.x(), y: e.target.y() });
  };

  // Handle canvas drag end - save new position to history
  const handleDragEnd = (e) => {
    const newPos = { x: e.target.x(), y: e.target.y() };

    // Only save the position change to history if the position actually changed
    if (dragStartPos &&
      (dragStartPos.x !== newPos.x || dragStartPos.y !== newPos.y)) {
      saveImagePosition(newPos);
    }

    setImagePos(newPos);
    setCanvasImagePos(newPos);
  };

  // Define cursor types for different tools and states
  const getCursorStyle = () => {
    if (isOverVertex) {
      return 'grab';
    }

    if (isOverAnnotation) {
      return effectiveTool === 'move' ? 'move' : 'pointer';
    }

    switch (effectiveTool) {
      case 'move':
        return 'default';
      case 'bbox':
        return 'crosshair';
      case 'polygon':
        return 'crosshair';
      case 'polyline':
        return 'crosshair';
      case 'ellipse':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  // Handle wheel zoom
  const handleWheelZoom = (evt) => {
    const result = handleWheel(evt);
    if (result && result.action === 'zoom') {
      onWheelZoom(result.delta);
    }
  };

  // Listen for finish-polygon and finish-polyline events from keyboard shortcuts
  useEffect(() => {
    const handleFinishPolygon = () => {
      if (drawingState.isDrawing && drawingState.points?.length >= 3) {
        finishDrawing('polygon');
      }
    };

    const handleFinishPolyline = () => {
      if (drawingState.isDrawing && drawingState.points?.length >= 2) {
        finishDrawing('polyline');
      }
    };

    const handleCancelAnnotation = () => {
      cancelDrawing();
      // Reset to move tool on cancel
      setEffectiveTool('move');
      if (typeof dispatchToolAction === 'function') {
        dispatchToolAction('move');
      }
    };

    window.addEventListener('finish-polygon', handleFinishPolygon);
    window.addEventListener('finish-polyline', handleFinishPolyline);
    window.addEventListener('cancel-annotation', handleCancelAnnotation);

    return () => {
      window.removeEventListener('finish-polygon', handleFinishPolygon);
      window.removeEventListener('finish-polyline', handleFinishPolyline);
      window.removeEventListener('cancel-annotation', handleCancelAnnotation);
    };
  }, [drawingState, finishDrawing, cancelDrawing, dispatchToolAction]);

  // Window / container sizing
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      setDims({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render the selection marquee
  const renderSelectionMarquee = () => {
    if (!selectionMarquee.visible) return null;

    const x = Math.min(selectionMarquee.startX, selectionMarquee.endX);
    const y = Math.min(selectionMarquee.startY, selectionMarquee.endY);
    const width = Math.abs(selectionMarquee.endX - selectionMarquee.startX);
    const height = Math.abs(selectionMarquee.endY - selectionMarquee.startY);

    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="#3498db"
        strokeWidth={1.5 / scale}
        dash={[5 / scale, 5 / scale]}
        fill="#3498db"
        opacity={0.2}
      />
    );
  };

  return (
    <div className="canvas-container" ref={containerRef}>
      {dims.width > 0 && dims.height > 0 && konvaImg && konvaImg.width > 0 && konvaImg.height > 0 ? (
        <Stage
          ref={stageRef}
          width={dims.width}
          height={dims.height}
          scaleX={scale}
          scaleY={scale}
          style={{
            background: '#dfe6e9',
            cursor: getCursorStyle(),
          }}
          onDblClick={(e) => {
            // Get the element type that was clicked directly
            const clickedElementType = e.target.getClassName ? e.target.getClassName() : "unknown";

            // Simple solution: only call parent handler if we clicked directly on the background image
            // and not on any annotation elements
            if (clickedElementType === 'Image' && e.target.name() === 'background-image') {
              // We clicked directly on the background image, call the parent handler
              onDblClick && onDblClick(e);
            }
            // Otherwise, we clicked on an annotation, do nothing
          }}
          onWheel={handleWheelZoom}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveStage}
          onMouseUp={handleMouseUp}
          onContextMenu={handleCustomContextMenu}
        >
          <Layer>
            <Group
              id="anno-group"
              draggable={effectiveTool === 'move'}
              x={imagePos.x}
              y={imagePos.y}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Background image */}
              {konvaImg && konvaImg.width > 0 && konvaImg.height > 0 && (
                <KonvaImage
                  image={konvaImg}
                  width={konvaImg.width}
                  height={konvaImg.height}
                  name="background-image"
                  onClick={() => setSelectedAnnotationIndex(null)}
                />
              )}

              {/* Render existing annotations */}
              <ShapeRenderer
                annotations={currentShapes}
                selectedAnnotationIndex={selectedAnnotationIndex}
                selectedAnnotationIndices={selectedAnnotationIndices}
                scale={scale}
                onSelect={setSelectedAnnotationIndex}
                onMultiSelect={toggleMultiSelect}
                onDeleteAnnotation={deleteAnnotation}
                onUpdateAnnotation={updateAnnotation}
                onShowPointAdjuster={setShowPointAdjuster}
                activeLabelColor={activeLabelColor}
                selectedTool={effectiveTool}
                setIsOverVertex={setIsOverVertex}
                setIsOverAnnotation={setIsOverAnnotation}
                shapeRefs={shapeRefs}
                showLabels={showLabels}
                setPreviewVertex={setPreviewVertex}
                clearPreviewVertex={clearPreviewVertex}
                previewVertex={drawingState.previewVertex}
                hoveredShapeRef={hoveredShapeRef}
              />

              {/* In-progress shapes */}
              <AnnotationCreator
                drawingState={drawingState}
                scale={scale}
                activeLabelColor={activeLabelColor}
                selectedTool={effectiveTool}
              />

              {/* Selection marquee */}
              {renderSelectionMarquee()}
            </Group>

            {/* Transformer for resizing/moving shapes */}
            {effectiveTool === 'move' && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                anchorSize={8 / scale}
                borderDash={[6, 2]}
                onTransformEnd={handleTransformEnd}
                onDragEnd={handleTransformEnd}
              />
            )}
          </Layer>
        </Stage>
      ) : (
        <div>Loading image...</div>
      )}

      {/* Point Reduction Panel */}
      {drawingState.showPointReductionPanel && (
        <PointReductionPanel
          originalPoints={drawingState.originalPoints}
          currentPoints={drawingState.currentPoints}
          distanceThreshold={drawingState.distanceThreshold}
          onThresholdChange={handleThresholdChange}
          onApply={applyPointReduction}
          onCancel={cancelPointReduction}
        />
      )}

      {/* Point Adjustment Panel */}
      {showPointAdjuster && selectedAnnotationIndex !== null &&
        (currentShapes[selectedAnnotationIndex]?.type === 'polygon' ||
          currentShapes[selectedAnnotationIndex]?.type === 'polyline') && (
          <PolygonPointAdjuster
            annotation={currentShapes[selectedAnnotationIndex]}
            index={selectedAnnotationIndex}
            onUpdate={updateAnnotation}
            onClose={() => setShowPointAdjuster(false)}
            stage={stageRef.current}
            scale={scale}
          />
        )}

      {/* Help panel for polygon drawing */}
      {drawingState.isDrawing && (effectiveTool === 'polygon' || effectiveTool === 'polyline') && (
        <div className="drawing-helper-hint" style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {drawingState.isDraggingWithCtrl && (
            <>
              <span style={{
                color: '#4CAF50',
                fontWeight: 'bold',
                marginRight: '5px'
              }}>
                Drawing with Ctrl
              </span>
              <span style={{ margin: '0 8px', opacity: 0.7 }}>|</span>
              Release to finish
            </>
          )}
          {!drawingState.isDraggingWithCtrl && (
            <>
              Click first point to close
              <span style={{ margin: '0 8px', opacity: 0.7 }}>|</span>
              Press <kbd style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '2px 5px',
                borderRadius: '3px',
                margin: '0 2px',
              }}>Space</kbd> or <kbd style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '2px 5px',
                borderRadius: '3px',
                margin: '0 2px',
              }}>Enter</kbd> to finish
              <span style={{ margin: '0 8px', opacity: 0.7 }}>|</span>
              <span style={{
                color: '#FFC107',
                fontWeight: 'bold',
                marginRight: '5px'
              }}>
                Hold Ctrl to draw continuously
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DetectionCanvas;