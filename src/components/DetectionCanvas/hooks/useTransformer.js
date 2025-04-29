import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to handle the Konva Transformer for resizing and moving shapes
 * 
 * @param {Number} selectedAnnotationIndex - Index of the selected annotation 
 * @param {Array} annotations - Array of annotation objects
 * @param {Function} updateAnnotation - Function to update an annotation
 * @param {Object} konvaImg - The image object for boundary checking
 * @param {Function} clipAnnotationToBoundary - Function to clip shapes to image boundaries
 */
const useTransformer = ({
  selectedAnnotationIndex,
  selectedAnnotationIndices = [],
  annotations,
  updateAnnotation,
  updateMultipleAnnotations,
  konvaImg,
  clipAnnotationToBoundary,
  selectedTool
}) => {
  // Reference to the Transformer component
  const transformerRef = useRef(null);
  
  // Reference to shape nodes that can be transformed
  const shapeRefs = useRef({});
  
  // Connect transformer to selected shape(s)
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // Only enable transformer for move tool
    if (selectedTool !== 'move') {
      transformer.nodes([]);
      return;
    }

    if (selectedAnnotationIndex !== null && shapeRefs.current[selectedAnnotationIndex]) {
      // For bbox and ellipse shapes, connect transformer
      const ann = annotations[selectedAnnotationIndex];
      
      if (ann && (ann.type === 'bbox' || ann.type === 'ellipse')) {
        // Connect transformer to the selected node
        transformer.nodes([shapeRefs.current[selectedAnnotationIndex]]);
        transformer.getLayer()?.batchDraw();
      } else {
        // Don't show transformer for polygon/polyline
        transformer.nodes([]);
      }
    } else {
      // Clear transformer if no selection
      transformer.nodes([]);
    }
  }, [selectedAnnotationIndex, selectedAnnotationIndices, annotations, selectedTool]);

  // Clear nodes when changing tools
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    
    if (selectedTool !== 'move') {
      transformer.nodes([]);
    }
  }, [selectedTool]);

  // Handle transform end (resize/move completed)
  const handleTransformEnd = useCallback(() => {
    if (selectedAnnotationIndex === null) return;
    
    const shapeNode = shapeRefs.current[selectedAnnotationIndex];
    if (!shapeNode) return;
    
    const ann = annotations[selectedAnnotationIndex];
    if (!ann || (ann.type !== 'bbox' && ann.type !== 'ellipse')) return;
    
    const scaleX = shapeNode.scaleX();
    const scaleY = shapeNode.scaleY();
    const offsetX = shapeNode.x();
    const offsetY = shapeNode.y();
    
    let updatedProps = {};
    
    // Different logic based on shape type
    if (ann.type === 'bbox') {
      updatedProps = {
        x: offsetX,
        y: offsetY,
        width: shapeNode.width() * scaleX,
        height: shapeNode.height() * scaleY
      };
    } else if (ann.type === 'ellipse') {
      updatedProps = {
        x: offsetX,
        y: offsetY,
        radiusX: (shapeNode.width() / 2) * scaleX,
        radiusY: (shapeNode.height() / 2) * scaleY
      };
    }
    
    // Reset the node's transformation
    shapeNode.scaleX(1);
    shapeNode.scaleY(1);
    shapeNode.x(0);
    shapeNode.y(0);
    
    // Update the annotation with new properties
    // Clip to image boundaries if needed
    if (konvaImg && clipAnnotationToBoundary) {
      const clipped = clipAnnotationToBoundary(
        { ...ann, ...updatedProps },
        konvaImg.width,
        konvaImg.height
      );
      
      if (clipped) {
        updateAnnotation(selectedAnnotationIndex, clipped);
      } else {
        // If completely outside, delete the annotation
        // This should be handled in the updateAnnotation function
        updateAnnotation(selectedAnnotationIndex, updatedProps);
      }
    } else {
      updateAnnotation(selectedAnnotationIndex, updatedProps);
    }
  }, [selectedAnnotationIndex, annotations, updateAnnotation, konvaImg, clipAnnotationToBoundary]);

  // Cleanup function to reset shapeRefs when changing images or annotations
  const resetRefs = useCallback(() => {
    shapeRefs.current = {};
  }, []);

  return {
    transformerRef,
    shapeRefs,
    handleTransformEnd,
    resetRefs
  };
};

export default useTransformer;