import React from 'react';
import { Label, Tag, Text } from 'react-konva';

// A small Konva Label to let user delete a selected annotation
const DeleteLabel = ({ annotation, scale, shapeBoundingBox, onDelete, color, position }) => {
  // If position is directly provided, use it; otherwise calculate from bounding box
  let xPos, yPos;
  
  if (position) {
    xPos = position.x;
    yPos = position.y;
  } else {
    const box = shapeBoundingBox(annotation);
    if (!box) return null;
    
    // For bounding boxes, position the delete button at the top-left corner but outside
    if (annotation.type === 'bbox') {
      xPos = box.x1 - 10 / scale; // Position 10px to the left
      yPos = box.y1 - 30 / scale; // Position 20px above
    } else {
      // For other shapes, use the top-left corner
      xPos = box.x1;
      yPos = box.y1 - 20 / scale; // 20px above, scaled
    }
  }

  return (
    <Label
      x={xPos}
      y={yPos}
      onClick={(e) => {
        e.cancelBubble = true;
        onDelete();
      }}
      scaleX={1 / scale}
      scaleY={1 / scale}
    >
      <Tag fill={color || 'red'} opacity={0.9} cornerRadius={4} />
      <Text text="Delete" fill="#fff" padding={5} fontSize={14} />
    </Label>
  );
};

export default DeleteLabel;