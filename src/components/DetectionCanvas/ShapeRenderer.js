import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Group,
  Line,
  Rect,
  Circle,
  Ellipse,
  Path,
  Arrow,
} from 'react-konva';
import DeleteLabel from './DeleteLabel';
import { flattenPoints, polygonToPath } from './utils/geometryUtils';
import { shapeBoundingBox } from './utils/shapeUtils';

const ShapeRenderer = ({
  annotations = [],
  selectedAnnotationIndex,
  selectedAnnotationIndices = [],
  scale,
  onSelect,
  onMultiSelect,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onShowPointAdjuster,
  activeLabelColor,
  selectedTool,
  setIsOverVertex,
  setIsOverAnnotation,
  shapeRefs,
  showLabels = false,
  setPreviewVertex,
  clearPreviewVertex,
  previewVertex
}) => {
  // Vertex being edited with live preview
  const [hoveredVertexInfo, setHoveredVertexInfo] = useState(null);

  // Track which annotation is being hovered for better UX
  const [hoveredAnnotationIndex, setHoveredAnnotationIndex] = useState(null);

  // Keep track of shapes that need vertex handles
  const [shapesWithVisibleVertices, setShapesWithVisibleVertices] = useState(new Set());

  // Calculate delete button position
  const getDeletePosition = useCallback((annotation) => {
    const box = shapeBoundingBox(annotation);
    if (!box) return { x: 0, y: 0 };

    // For polygons, position closer to the shape
    if (annotation.type === 'polygon' || annotation.type === 'polyline') {
      // Find top-most point
      let minY = Infinity;
      let topX = 0;

      annotation.points.forEach(pt => {
        if (pt.y < minY) {
          minY = pt.y;
          topX = pt.x;
        }
      });

      return { x: topX, y: minY - 25 / scale };
    }

    return { x: box.x1, y: box.y1 - 20 / scale };
  }, [scale]);

  // Handle vertex drag
  const handleVertexDragStart = useCallback((annIndex, vertexIndex, e) => {
    e.cancelBubble = true;
    // Change cursor style directly on the body element
    document.body.style.cursor = 'grabbing';

    // Set the preview vertex state
    const annotation = annotations[annIndex];
    if (annotation && annotation.points && annotation.points[vertexIndex]) {
      setPreviewVertex?.(
        annIndex,
        vertexIndex,
        { ...annotation.points[vertexIndex] },
        { ...annotation.points[vertexIndex] }
      );
    }
  }, [annotations, setPreviewVertex]);

  const handleVertexDragMove = useCallback((e) => {
    document.body.style.cursor = 'grabbing';

    // Update the preview vertex position
    if (previewVertex) {
      const { x, y } = e.target.position();
      setPreviewVertex?.(
        previewVertex.annIndex,
        previewVertex.vertexIndex,
        { x, y },
        previewVertex.initialPoint
      );
    }
  }, [previewVertex, setPreviewVertex]);

  const handleVertexDragEnd = useCallback((annIndex, vertexIndex, e) => {
    e.cancelBubble = true;
    const { x, y } = e.target.position();

    const annotation = annotations[annIndex];
    const updatedPoints = [...annotation.points];
    updatedPoints[vertexIndex] = { x, y };

    onUpdateAnnotation(annIndex, { points: updatedPoints });

    // Clear the preview vertex
    clearPreviewVertex?.();

    // Reset cursor
    document.body.style.cursor = '';
  }, [annotations, onUpdateAnnotation, clearPreviewVertex]);

  // Handle bbox drag
  const handleBBoxDragEnd = useCallback((index, e) => {
    const { x, y } = e.target.position();
    onUpdateAnnotation(index, { x, y });
  }, [onUpdateAnnotation]);

  // Handle ellipse drag
  const handleEllipseDragEnd = useCallback((index, e) => {
    const { x, y } = e.target.position();
    onUpdateAnnotation(index, { x, y });
  }, [onUpdateAnnotation]);

  // Handle polygon/polyline drag
  const handlePolyDragEnd = useCallback((index, e) => {
    const { x, y } = e.target.position();
    const ann = annotations[index];
    const newPoints = ann.points.map((pt) => ({
      x: pt.x + x,
      y: pt.y + y,
    }));

    e.target.position({ x: 0, y: 0 });
    onUpdateAnnotation(index, { points: newPoints });
  }, [annotations, onUpdateAnnotation]);

  // Handle removing a vertex
  const handleRemoveVertex = useCallback((annIndex, vertexIndex, e) => {
    e.preventDefault();
    e.cancelBubble = true;

    const annotation = annotations[annIndex];
    const updatedPoints = [...annotation.points];

    // Remove the vertex
    updatedPoints.splice(vertexIndex, 1);

    // Check if we need to delete the entire shape due to insufficient points
    if ((annotation.type === 'polygon' && updatedPoints.length < 3) ||
      (annotation.type === 'polyline' && updatedPoints.length < 2)) {
      onDeleteAnnotation(annIndex);
    } else {
      onUpdateAnnotation(annIndex, { points: updatedPoints });
    }

    // Reset cursor
    document.body.style.cursor = '';
  }, [annotations, onDeleteAnnotation, onUpdateAnnotation]);

  // Handle inserting a new vertex
  const handleInsertVertex = useCallback((annIndex, vertexIndex, e) => {
    e.cancelBubble = true;

    const ann = annotations[annIndex];

    if (ann.type !== 'polygon' && ann.type !== 'polyline') return;

    const shapePoints = [...ann.points];
    const length = shapePoints.length;
    if (length < 2) return;

    let nextIndex;
    if (ann.type === 'polygon') {
      nextIndex = (vertexIndex + 1) % length;
    } else {
      if (vertexIndex === length - 1) return;
      nextIndex = vertexIndex + 1;
    }

    const currentPt = shapePoints[vertexIndex];
    const nextPt = shapePoints[nextIndex];

    const midX = (currentPt.x + nextPt.x) / 2;
    const midY = (currentPt.y + nextPt.y) / 2;

    shapePoints.splice(vertexIndex + 1, 0, { x: midX, y: midY });
    onUpdateAnnotation(annIndex, { points: shapePoints });
  }, [annotations, onUpdateAnnotation]);

  // Custom vertex cursor styles
  const vertexCursorEnter = useCallback((annIndex, vertexIndex) => {
    document.body.style.cursor = 'url(data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="%234CAF50"/></svg>) 12 12, grab';
    setIsOverVertex?.(true);
    setHoveredVertexInfo({ annIndex, vertexIndex });
  }, [setIsOverVertex]);

  const vertexCursorLeave = useCallback(() => {
    document.body.style.cursor = '';
    setIsOverVertex?.(false);
    setHoveredVertexInfo(null);
  }, [setIsOverVertex]);

  // Handle area around a point (for easier deletion)
  const isNearPoint = useCallback((x, y, point, threshold = 10) => {
    const dx = point.x - x;
    const dy = point.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= threshold / scale;
  }, [scale]);
  const handlePolyAreaContextMenu = useCallback((annIndex, e) => {
    e.evt.preventDefault();
    e.cancelBubble = true;

    const ann = annotations[annIndex];
    if (ann.type !== 'polygon' && ann.type !== 'polyline') return;

    // Get pointer position
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const transform = stage.findOne('#anno-group').getAbsoluteTransform().copy().invert();
    const point = transform.point(pos);

    // Check if the point is near any vertex
    let foundIndex = -1;
    for (let i = 0; i < ann.points.length; i++) {
      if (isNearPoint(point.x, point.y, ann.points[i])) {
        foundIndex = i;
        break;
      }
    }

    // Delete the vertex if found
    if (foundIndex >= 0) {
      handleRemoveVertex(annIndex, foundIndex, e.evt);
    }
  }, [annotations, handleRemoveVertex, isNearPoint]);

  // Use a ref to keep track of which shape is currently being hovered
  const hoveredShapeRef = useRef(null);

  // Set up effects to clear shape references when component unmounts
  useEffect(() => {
    return () => {
      // Clear shape refs when component unmounts
      if (shapeRefs && shapeRefs.current) {
        Object.keys(shapeRefs.current).forEach(key => {
          delete shapeRefs.current[key];
        });
      }
    };
  }, [shapeRefs]);

  // Effect to track which shapes should have visible vertices
  useEffect(() => {
    // Only show vertices for the selected shape or a shape that's being hovered
    const newShapesWithVisibleVertices = new Set();
    
    if (selectedAnnotationIndex !== null) {
      newShapesWithVisibleVertices.add(selectedAnnotationIndex);
    }
    
    if (hoveredAnnotationIndex !== null && !newShapesWithVisibleVertices.has(hoveredAnnotationIndex)) {
      newShapesWithVisibleVertices.add(hoveredAnnotationIndex);
    }
    
    setShapesWithVisibleVertices(newShapesWithVisibleVertices);
  }, [selectedAnnotationIndex, hoveredAnnotationIndex]);

  // Render a preview of the polygon with the dragged vertex
  const renderPreviewPolygon = useCallback(() => {
    if (!previewVertex) return null;

    const { annIndex, vertexIndex, point } = previewVertex;
    const annotation = annotations[annIndex];

    if (!annotation || !annotation.points) return null;

    // Create a copy of the points with the updated position for the dragged vertex
    const previewPoints = [...annotation.points];
    previewPoints[vertexIndex] = point;

    const flatPoints = flattenPoints(previewPoints);

    return (
      <Line
        points={flatPoints}
        stroke={annotation.color || activeLabelColor}
        strokeWidth={(1.5 / scale)}
        fill={annotation.color + '33'}
        opacity={0.8}
        dash={[5, 5]}
        closed={annotation.type === 'polygon'}
      />
    );
  }, [previewVertex, annotations, activeLabelColor, scale]);

  // Helper to determine if an annotation should show vertices
  const shouldShowVertices = useCallback((index) => {
    return selectedTool === 'move' && shapesWithVisibleVertices.has(index);
  }, [selectedTool, shapesWithVisibleVertices]);

  // Optimize polygon/polyline rendering by reducing points when not selected
  const getOptimizedPoints = useCallback((points, isSelected) => {
    // If selected or hovering, show all points
    if (isSelected) return points;
    
    // For non-selected polygons with lots of points, reduce the number for rendering
    // This significantly improves performance without affecting functionality
    if (points.length > 100) {
      const step = Math.ceil(points.length / 100);
      const reducedPoints = [];
      for (let i = 0; i < points.length; i += step) {
        reducedPoints.push(points[i]);
      }
      // Make sure to include the last point
      if (points.length > 0 && 
         (reducedPoints.length === 0 || 
          reducedPoints[reducedPoints.length - 1] !== points[points.length - 1])) {
        reducedPoints.push(points[points.length - 1]);
      }
      return reducedPoints;
    }
    
    return points;
  }, []);

  // Render individual shapes
  const renderShape = useCallback((ann, i) => {
    const annColor = ann.color || activeLabelColor || '#ff0000';
    const fillColor = annColor + '55';
    const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;
    const isSelected = selectedAnnotationIndex === i || selectedAnnotationIndices.includes(i);
    const isHovered = hoveredAnnotationIndex === i;
    const strokeWidth = isSelected ? (3 / scale) : (isHovered ? (2.5 / scale) : (2 / scale));
    const showVertices = shouldShowVertices(i);

    // Only register shapes in the shapeRefs if they're of a type that can be transformed
    if (ann.type === 'bbox') {
      return (
        <React.Fragment key={i}>
          <Rect
            ref={(node) => {
              if (node) {
                shapeRefs.current[i] = node;
              } else if (shapeRefs.current[i]) {
                delete shapeRefs.current[i];
              }
            }}
            x={ann.x}
            y={ann.y}
            width={ann.width}
            height={ann.height}
            fill={annColor + '55'}
            stroke={annColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            draggable={selectedTool === 'move'}
            onMouseDown={(e) => (e.cancelBubble = true)}
            onDragStart={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = 'grabbing';
            }}
            onDragMove={(e) => (e.cancelBubble = true)}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = '';
              handleBBoxDragEnd(i, e);
            }}
            onClick={(e) => {
              if (selectedTool === 'move') {
                e.cancelBubble = true;
                if (e.evt.shiftKey) {
                  onMultiSelect?.(i);
                } else {
                  onSelect(i);
                }
              }
            }}
            onMouseEnter={() => {
              setIsOverAnnotation?.(true);
              document.body.style.cursor = 'pointer';
              hoveredShapeRef.current = i;
              setHoveredAnnotationIndex(i);
            }}
            onMouseLeave={() => {
              setIsOverAnnotation?.(false);
              document.body.style.cursor = '';
              hoveredShapeRef.current = null;
              setHoveredAnnotationIndex(null);
            }}
          />
          {isSelected && (
            <DeleteLabel
              annotation={ann}
              scale={scale}
              shapeBoundingBox={shapeBoundingBox}
              onDelete={() => onDeleteAnnotation(i)}
              color={annColor}
            />
          )}
        </React.Fragment>
      );
    } else if (ann.type === 'ellipse') {
      return (
        <React.Fragment key={i}>
          <Ellipse
            ref={(node) => {
              if (node) {
                shapeRefs.current[i] = node;
              } else if (shapeRefs.current[i]) {
                delete shapeRefs.current[i];
              }
            }}
            x={ann.x}
            y={ann.y}
            radiusX={ann.radiusX}
            radiusY={ann.radiusY}
            rotation={ann.rotation || 0}
            fill={annColor + '55'}
            stroke={annColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            draggable={selectedTool === 'move'}
            onMouseDown={(e) => (e.cancelBubble = true)}
            onDragStart={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = 'grabbing';
            }}
            onDragMove={(e) => (e.cancelBubble = true)}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = '';
              handleEllipseDragEnd(i, e);
            }}
            onClick={(e) => {
              if (selectedTool === 'move') {
                e.cancelBubble = true;
                if (e.evt.shiftKey) {
                  onMultiSelect?.(i);
                } else {
                  onSelect(i);
                }
              }
            }}
            onMouseEnter={() => {
              setIsOverAnnotation?.(true);
              document.body.style.cursor = 'pointer';
              hoveredShapeRef.current = i;
              setHoveredAnnotationIndex(i);
            }}
            onMouseLeave={() => {
              setIsOverAnnotation?.(false);
              document.body.style.cursor = '';
              hoveredShapeRef.current = null;
              setHoveredAnnotationIndex(null);
            }}
          />
          {isSelected && (
            <DeleteLabel
              annotation={ann}
              scale={scale}
              shapeBoundingBox={shapeBoundingBox}
              onDelete={() => onDeleteAnnotation(i)}
              color={annColor}
            />
          )}
        </React.Fragment>
      );
    } else if (ann.type === 'polyline') {
      // Use optimized points for better performance
      const displayPoints = getOptimizedPoints(ann.points, isSelected || isHovered);
      const pts = flattenPoints(displayPoints);
      const firstPt = ann.points[0];
      const secondPt = ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };

      return (
        <React.Fragment key={i}>
          <Group
            draggable={selectedTool === 'move'}
            onMouseDown={(e) => (e.cancelBubble = true)}
            onDragStart={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              document.body.style.cursor = '';
              handlePolyDragEnd(i, e);
            }}
            onClick={(e) => {
              if (selectedTool === 'move') {
                e.cancelBubble = true;
                if (e.evt.shiftKey) {
                  onMultiSelect?.(i);
                } else {
                  onSelect(i);
                  // Only show point adjuster on double-click
                  if (e.evt.detail === 2) {
                    if (onShowPointAdjuster) onShowPointAdjuster(true);
                  }
                }
              }
            }}
            onContextMenu={(e) => handlePolyAreaContextMenu(i, e)}
            onMouseEnter={() => {
              setIsOverAnnotation?.(true);
              document.body.style.cursor = 'pointer';
              hoveredShapeRef.current = i;
              setHoveredAnnotationIndex(i);
            }}
            onMouseLeave={() => {
              setIsOverAnnotation?.(false);
              document.body.style.cursor = '';
              hoveredShapeRef.current = null;
              setHoveredAnnotationIndex(null);
            }}
          >
            <Line
              points={pts}
              stroke={annColor}
              strokeWidth={strokeWidth}
              closed={false}
              opacity={opacity}
            />
            {/* Only render vertices when needed for better performance */}
            {showVertices && ann.points.map((pt, idx) => (
              <Circle
                key={idx}
                x={pt.x}
                y={pt.y}
                radius={7 / scale} // Increased size for better visibility
                fill={
                  idx === 0 ?
                    annColor : // First point always highlighted
                    (hoveredVertexInfo?.annIndex === i && hoveredVertexInfo?.vertexIndex === idx ?
                      annColor : // Highlighted on hover
                      "#ffffff") // Normal state
                }
                stroke={annColor}
                strokeWidth={2 / scale} // Thicker stroke
                opacity={opacity}
                draggable={selectedTool === 'move'}
                name="vertex"
                shadowColor="black"
                shadowBlur={3 / scale}
                shadowOpacity={0.3}
                shadowOffset={{ x: 1 / scale, y: 1 / scale }}
                onMouseDown={(ev) => (ev.cancelBubble = true)}
                onDragStart={(ev) => handleVertexDragStart(i, idx, ev)}
                onDragMove={handleVertexDragMove}
                onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                onContextMenu={(ev) => {
                  ev.evt.preventDefault();
                  ev.cancelBubble = true;
                  handleRemoveVertex(i, idx, ev.evt);
                }}
                onClick={(ev) => {
                  if (selectedTool === 'move') {
                    ev.cancelBubble = true;
                    handleInsertVertex(i, idx, ev);
                  }
                }}
                onMouseEnter={() => vertexCursorEnter(i, idx)}
                onMouseLeave={vertexCursorLeave}
              />
            ))}
            <Arrow
              points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
              fill={annColor}
              stroke={annColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              pointerLength={10 / scale}
              pointerWidth={8 / scale}
            />
          </Group>
          {isSelected && (
            <DeleteLabel
              annotation={ann}
              scale={scale}
              shapeBoundingBox={shapeBoundingBox}
              onDelete={() => onDeleteAnnotation(i)}
              color={annColor}
              position={getDeletePosition(ann)}
            />
          )}
        </React.Fragment>
      );
    } else if (ann.type === 'polygon') {
      if (ann.holes && ann.holes.length > 0) {
        const pathData = polygonToPath(ann.points, ann.holes);

        return (
          <React.Fragment key={i}>
            <Group
              draggable={selectedTool === 'move'}
              onMouseDown={(e) => (e.cancelBubble = true)}
              onDragStart={(e) => {
                e.cancelBubble = true;
                document.body.style.cursor = 'grabbing';
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                document.body.style.cursor = '';
                handlePolyDragEnd(i, e);
              }}
              onClick={(e) => {
                if (selectedTool === 'move') {
                  e.cancelBubble = true;
                  if (e.evt.shiftKey) {
                    onMultiSelect?.(i);
                  } else {
                    onSelect(i);
                    // Only show point adjuster on double-click
                    if (e.evt.detail === 2 && onShowPointAdjuster) {
                      onShowPointAdjuster(true);
                    }
                  }
                }
              }}
              onContextMenu={(e) => handlePolyAreaContextMenu(i, e)}
              onMouseEnter={() => {
                setIsOverAnnotation?.(true);
                document.body.style.cursor = 'pointer';
                hoveredShapeRef.current = i;
                setHoveredAnnotationIndex(i);
              }}
              onMouseLeave={() => {
                setIsOverAnnotation?.(false);
                document.body.style.cursor = '';
                hoveredShapeRef.current = null;
                setHoveredAnnotationIndex(null);
              }}
            >
              <Path
                data={pathData}
                fill={annColor + '55'}
                stroke={annColor}
                strokeWidth={strokeWidth}
                fillRule="evenodd"
                opacity={opacity}
              />
              {/* Only render vertices when needed */}
              {showVertices && ann.points.map((pt, idx) => (
                <Circle
                  key={idx}
                  x={pt.x}
                  y={pt.y}
                  radius={7 / scale} // Increased size for better visibility
                  fill={
                    idx === 0 ?
                      annColor : // First point always highlighted
                      (hoveredVertexInfo?.annIndex === i && hoveredVertexInfo?.vertexIndex === idx ?
                        annColor : // Highlighted on hover
                        "#ffffff") // Normal state
                  }
                  stroke={annColor}
                  strokeWidth={2 / scale} // Thicker stroke
                  opacity={opacity}
                  draggable={selectedTool === 'move'}
                  name="vertex"
                  shadowColor="black"
                  shadowBlur={3 / scale}
                  shadowOpacity={0.3}
                  shadowOffset={{ x: 1 / scale, y: 1 / scale }}
                  onMouseDown={(ev) => (ev.cancelBubble = true)}
                  onDragStart={(ev) => handleVertexDragStart(i, idx, ev)}
                  onDragMove={handleVertexDragMove}
                  onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                  onContextMenu={(ev) => {
                    ev.evt.preventDefault();
                    ev.cancelBubble = true;
                    handleRemoveVertex(i, idx, ev.evt);
                  }}
                  onClick={(ev) => {
                    if (selectedTool === 'move') {
                      ev.cancelBubble = true;
                      handleInsertVertex(i, idx, ev);
                    }
                  }}
                  onMouseEnter={() => vertexCursorEnter(i, idx)}
                  onMouseLeave={vertexCursorLeave}
                />
              ))}
            </Group>
            {isSelected && (
              <DeleteLabel
                annotation={ann}
                scale={scale}
                shapeBoundingBox={shapeBoundingBox}
                onDelete={() => onDeleteAnnotation(i)}
                color={annColor}
                position={getDeletePosition(ann)}
              />
            )}
          </React.Fragment>
        );
        } else {
          // Regular polygon without holes - use optimized points for better performance
          const displayPoints = getOptimizedPoints(ann.points, isSelected || isHovered);
          const pts = flattenPoints(displayPoints);
          const firstPt = ann.points[0];
          const secondPt = ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };

          return (
            <React.Fragment key={i}>
              <Group
                draggable={selectedTool === 'move'}
                onMouseDown={(e) => (e.cancelBubble = true)}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  document.body.style.cursor = 'grabbing';
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  document.body.style.cursor = '';
                  handlePolyDragEnd(i, e);
                }}
                onClick={(e) => {
                  if (selectedTool === 'move') {
                    e.cancelBubble = true;
                    if (e.evt.shiftKey) {
                      onMultiSelect?.(i);
                    } else {
                      onSelect(i);
                      // Only show point adjuster on double-click
                      if (e.evt.detail === 2 && onShowPointAdjuster) {
                        onShowPointAdjuster(true);
                      }
                    }
                  }
                }}
                onContextMenu={(e) => handlePolyAreaContextMenu(i, e)}
                onMouseEnter={() => {
                  setIsOverAnnotation?.(true);
                  document.body.style.cursor = 'pointer';
                  hoveredShapeRef.current = i;
                  setHoveredAnnotationIndex(i);
                }}
                onMouseLeave={() => {
                  setIsOverAnnotation?.(false);
                  document.body.style.cursor = '';
                  hoveredShapeRef.current = null;
                  setHoveredAnnotationIndex(null);
                }}
              >
                <Line
                  points={pts}
                  fill={annColor + '55'}
                  stroke={annColor}
                  strokeWidth={strokeWidth}
                  closed
                  opacity={opacity}
                />
                {/* Only render vertices when needed */}
                {showVertices && ann.points.map((pt, idx) => (
                  <Circle
                    key={idx}
                    x={pt.x}
                    y={pt.y}
                    radius={7 / scale} // Increased size for better visibility
                    fill={
                      idx === 0 ?
                        annColor : // First point always highlighted
                        (hoveredVertexInfo?.annIndex === i && hoveredVertexInfo?.vertexIndex === idx ?
                          annColor : // Highlighted on hover
                          "#ffffff") // Normal state
                    }
                    stroke={annColor}
                    strokeWidth={2 / scale} // Thicker stroke
                    opacity={opacity}
                    draggable={selectedTool === 'move'}
                    name="vertex"
                    shadowColor="black"
                    shadowBlur={3 / scale}
                    shadowOpacity={0.3}
                    shadowOffset={{ x: 1 / scale, y: 1 / scale }}
                    onMouseDown={(ev) => (ev.cancelBubble = true)}
                    onDragStart={(ev) => handleVertexDragStart(i, idx, ev)}
                    onDragMove={handleVertexDragMove}
                    onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                    onContextMenu={(ev) => {
                      ev.evt.preventDefault();
                      ev.cancelBubble = true;
                      handleRemoveVertex(i, idx, ev.evt);
                    }}
                    onClick={(ev) => {
                      if (selectedTool === 'move') {
                        ev.cancelBubble = true;
                        handleInsertVertex(i, idx, ev);
                      }
                    }}
                    onMouseEnter={() => vertexCursorEnter(i, idx)}
                    onMouseLeave={vertexCursorLeave}
                  />
                ))}
                {/* Only show the direction indicator when required */}
                {showVertices && (
                  <Arrow
                    points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
                    fill={annColor}
                    stroke={annColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    pointerLength={10 / scale}
                    pointerWidth={8 / scale}
                  />
                )}
              </Group>
              {isSelected && (
                <DeleteLabel
                  annotation={ann}
                  scale={scale}
                  shapeBoundingBox={shapeBoundingBox}
                  onDelete={() => onDeleteAnnotation(i)}
                  color={annColor}
                  position={getDeletePosition(ann)}
                />
              )}
            </React.Fragment>
          );
        }
      }

      return null;
    }, [
      annotations, 
      activeLabelColor, 
      selectedTool, 
      selectedAnnotationIndex, 
      selectedAnnotationIndices,
      scale, 
      hoveredAnnotationIndex, 
      hoveredVertexInfo,
      getOptimizedPoints,
      shouldShowVertices,
      onSelect,
      onMultiSelect,
      onDeleteAnnotation,
      onUpdateAnnotation,
      onShowPointAdjuster,
      handleVertexDragStart,
      handleVertexDragMove,
      handleVertexDragEnd,
      handleBBoxDragEnd,
      handleEllipseDragEnd,
      handlePolyDragEnd,
      handleRemoveVertex,
      handleInsertVertex,
      handlePolyAreaContextMenu,
      vertexCursorEnter,
      vertexCursorLeave,
      getDeletePosition,
      setIsOverAnnotation
    ]);

    return (
      <>
        {/* Draw a preview of the polygon while vertex is being dragged */}
        {renderPreviewPolygon()}

        {/* Render all shapes */}
        {annotations.map((ann, i) => renderShape(ann, i))}
      </>
    );
  };

  export default React.memo(ShapeRenderer);