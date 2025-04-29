import React from 'react';
import { Rect, Ellipse, Line, Circle, Arrow, Group, Text } from 'react-konva';
import { flattenPoints } from './utils/geometryUtils';

/**
 * Component for rendering in-progress annotations during creation
 */
const AnnotationCreator = ({
  drawingState,
  scale,
  activeLabelColor,
  selectedTool,
}) => {
  // If no drawing in progress and no point reduction panel, return null
  if (!drawingState.isDrawing && !drawingState.showPointReductionPanel) {
    return null;
  }

  // Render in-progress bounding box
  if (drawingState.currentShape?.type === 'bbox') {
    const box = drawingState.currentShape;
    return (
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={activeLabelColor + '55'} // Semi-transparent fill
        stroke={activeLabelColor}
        strokeWidth={2 / scale}
      />
    );
  }

  // Render in-progress ellipse
  if (drawingState.currentShape?.type === 'ellipse') {
    const ellipse = drawingState.currentShape;
    return (
      <Ellipse
        x={ellipse.x}
        y={ellipse.y}
        radiusX={ellipse.radiusX}
        radiusY={ellipse.radiusY}
        rotation={ellipse.rotation}
        fill={activeLabelColor + '55'}
        stroke={activeLabelColor}
        strokeWidth={2 / scale}
      />
    );
  }

  // Render in-progress polygon or point reduction preview
  if ((drawingState.isDrawing && selectedTool === 'polygon') || 
      (drawingState.showPointReductionPanel && drawingState.currentAnnotationType === 'polygon')) {
    const points = drawingState.isDrawing 
      ? drawingState.points 
      : (drawingState.isShowingReducedPreview ? drawingState.currentPoints : drawingState.originalPoints);
    
    if (!points || points.length === 0) return null;
    
    // Visual enhancements for polygon drawing
    return (
      <>
        {/* Ghost line connecting last point to cursor if drawing */}
        {drawingState.isDrawing && points.length > 0 && drawingState.lastMousePosition && (
          <Line
            points={[
              points[points.length - 1].x, 
              points[points.length - 1].y, 
              drawingState.lastMousePosition.x, 
              drawingState.lastMousePosition.y
            ]}
            stroke={activeLabelColor}
            strokeWidth={1.5 / scale}
            dash={[5 / scale, 5 / scale]}
            opacity={0.7}
          />
        )}
        
        {/* Polygon fill and outline */}
        {points.length > 1 && (
          <Line
            points={flattenPoints([...points])}
            fill={activeLabelColor + '55'}
            stroke={activeLabelColor}
            strokeWidth={2 / scale}
            closed
          />
        )}
        
        {/* Vertices */}
        {points.map((pt, idx) => (
          <Circle
            key={idx}
            x={pt.x}
            y={pt.y}
            radius={6 / scale}
            fill={idx === 0 ? activeLabelColor : "#fff"}
            stroke={activeLabelColor}
            strokeWidth={1.5 / scale}
            name="vertex"
          />
        ))}
        
        {/* Show direction indicator for first two points */}
        {points.length >= 2 && (
          <Arrow
            points={[points[1].x, points[1].y, points[0].x, points[0].y]}
            fill={activeLabelColor}
            stroke={activeLabelColor}
            strokeWidth={2 / scale}
            pointerLength={10 / scale}
            pointerWidth={8 / scale}
          />
        )}
        
        {/* Ctrl-drag indicator */}
        {drawingState.isDrawing && drawingState.isDraggingWithCtrl && (
          <Group
            x={10/scale}
            y={10/scale}
            scaleX={1/scale}
            scaleY={1/scale}
            opacity={0.9}
          >
            <Rect
              width={140}
              height={30}
              fill="#4CAF50"
              cornerRadius={4}
              shadowColor="black"
              shadowBlur={3}
              shadowOpacity={0.3}
            />
            <Text
              text="Release to finish"
              fill="white"
              width={140}
              height={30}
              align="center"
              verticalAlign="middle"
              fontSize={12}
              fontStyle="bold"
            />
          </Group>
        )}
      </>
    );
  }

  // Render in-progress polyline
  if ((drawingState.isDrawing && selectedTool === 'polyline') || 
      (drawingState.showPointReductionPanel && drawingState.currentAnnotationType === 'polyline')) {
    const points = drawingState.isDrawing 
      ? drawingState.points 
      : (drawingState.isShowingReducedPreview ? drawingState.currentPoints : drawingState.originalPoints);
    
    if (!points || points.length === 0) return null;

    return (
      <>
        {/* Ghost line connecting last point to cursor if drawing */}
        {drawingState.isDrawing && points.length > 0 && drawingState.lastMousePosition && (
          <Line
            points={[
              points[points.length - 1].x, 
              points[points.length - 1].y, 
              drawingState.lastMousePosition.x, 
              drawingState.lastMousePosition.y
            ]}
            stroke={activeLabelColor}
            strokeWidth={1.5 / scale}
            dash={[5 / scale, 5 / scale]}
            opacity={0.7}
          />
        )}
        
        {/* Line itself */}
        {points.length > 1 && (
          <Line
            points={flattenPoints(points)}
            stroke={activeLabelColor}
            strokeWidth={2 / scale}
            closed={false}
          />
        )}
        
        {/* Vertices */}
        {points.map((pt, idx) => (
          <Circle
            key={idx}
            x={pt.x}
            y={pt.y}
            radius={6 / scale}
            fill={idx === 0 ? activeLabelColor : "#fff"}
            stroke={activeLabelColor}
            strokeWidth={1.5 / scale}
            name="vertex"
          />
        ))}
        
        {/* Show direction indicator for first two points */}
        {points.length >= 2 && (
          <Arrow
            points={[points[1].x, points[1].y, points[0].x, points[0].y]}
            fill={activeLabelColor}
            stroke={activeLabelColor}
            strokeWidth={2 / scale}
            pointerLength={10 / scale}
            pointerWidth={8 / scale}
          />
        )}
        
        {/* Ctrl-drag indicator */}
        {drawingState.isDrawing && drawingState.isDraggingWithCtrl && (
          <Group
            x={10/scale}
            y={10/scale}
            scaleX={1/scale}
            scaleY={1/scale}
            opacity={0.9}
          >
            <Rect
              width={140}
              height={30}
              fill="#4CAF50"
              cornerRadius={4}
              shadowColor="black"
              shadowBlur={3}
              shadowOpacity={0.3}
            />
            <Text
              text="Release to finish"
              fill="white"
              width={140}
              height={30}
              align="center"
              verticalAlign="middle"
              fontSize={12}
              fontStyle="bold"
            />
          </Group>
        )}
      </>
    );
  }

  return null;
};

export default AnnotationCreator;