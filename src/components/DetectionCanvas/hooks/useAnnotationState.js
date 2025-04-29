import { useState, useEffect, useCallback, useRef } from 'react';
import { clipAnnotationToBoundary } from '../utils/clippingUtils';
import { cloneAnnotation, isPointInPolygon, findNearestPointInPolygon } from '../utils/shapeUtils';

/**
 * Custom hook to manage annotation state
 */
const useAnnotationState = ({
  initialAnnotations,
  onAnnotationsChange,
  externalSelectedIndex,
  onSelectAnnotation,
  konvaImg,
  imagePos,
  setImagePos,
}) => {
  // Current shapes to be rendered
  const [currentShapes, setCurrentShapes] = useState(initialAnnotations || []);
  
  // Selected annotation indices (single and multiple)
  const [selectedAnnotationIndex, setSelectedIndex] = useState(null);
  const [selectedAnnotationIndices, setSelectedIndices] = useState([]);
  
  // Undo/redo stacks - Now including image position
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  // Ref to track current position for undo/redo
  const lastImagePosRef = useRef(imagePos || { x: 0, y: 0 });
  
  // Update ref when imagePos changes externally
  useEffect(() => {
    lastImagePosRef.current = imagePos;
  }, [imagePos]);
  
  // Copied annotations for copy/paste
  const [copiedAnnotations, setCopiedAnnotations] = useState([]);

  // Sync with external annotations
  useEffect(() => {
    setCurrentShapes(initialAnnotations || []);
  }, [initialAnnotations]);

  // Sync with external selection
  useEffect(() => {
    setSelectedIndex(externalSelectedIndex);
    if (externalSelectedIndex !== null) {
      setSelectedIndices([externalSelectedIndex]);
    }
  }, [externalSelectedIndex]);

  // Handle single selection with external callback
  const setSelectedAnnotationIndex = useCallback((index) => {
    setSelectedIndex(index);
    setSelectedIndices(index !== null ? [index] : []);
    if (onSelectAnnotation) {
      onSelectAnnotation(index);
    }
  }, [onSelectAnnotation]);

  // Handle multi-selection (toggle)
  const toggleMultiSelect = useCallback((index) => {
    if (index === null) {
      setSelectedIndices([]);
      setSelectedIndex(null);
      if (onSelectAnnotation) {
        onSelectAnnotation(null);
      }
      return;
    }
    
    setSelectedIndices(prev => {
      const newIndices = prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index];
        
      // If there's only one selected or none, update the single selection too
      if (newIndices.length === 1) {
        setSelectedIndex(newIndices[0]);
        if (onSelectAnnotation) {
          onSelectAnnotation(newIndices[0]);
        }
      } else if (newIndices.length === 0) {
        setSelectedIndex(null);
        if (onSelectAnnotation) {
          onSelectAnnotation(null);
        }
      } else {
        // Keep the main selected index as the first one in the list
        setSelectedIndex(newIndices[0]);
        if (onSelectAnnotation) {
          onSelectAnnotation(newIndices[0]);
        }
      }
      
      return newIndices;
    });
  }, [onSelectAnnotation]);

  // Handle selecting multiple annotations at once (for selection marquee)
  const selectMultipleAnnotations = useCallback((indices, appendToExisting = false) => {
    if (!indices || indices.length === 0) {
      if (!appendToExisting) {
        setSelectedIndices([]);
        setSelectedIndex(null);
        if (onSelectAnnotation) {
          onSelectAnnotation(null);
        }
      }
      return;
    }

    setSelectedIndices(prev => {
      let newIndices;
      
      if (appendToExisting) {
        // Add to existing selection, removing duplicates
        newIndices = [...new Set([...prev, ...indices])];
      } else {
        // Replace existing selection
        newIndices = [...indices];
      }
      
      // Update the primary selected index
      if (newIndices.length > 0) {
        setSelectedIndex(newIndices[0]);
        if (onSelectAnnotation) {
          onSelectAnnotation(newIndices[0]);
        }
      } else {
        setSelectedIndex(null);
        if (onSelectAnnotation) {
          onSelectAnnotation(null);
        }
      }
      
      return newIndices;
    });
  }, [onSelectAnnotation]);

  // Update the annotations and trigger callback - now includes image position
  const updateAnnotationsWithPosition = useCallback((newShapes, newImagePos = null) => {
    // Save current state for undo
    setUndoStack(prev => [...prev, {
      shapes: currentShapes,
      imagePos: lastImagePosRef.current
    }]);
    
    // Clear redo stack since we've made a new change
    setRedoStack([]);
    
    // Update shapes
    setCurrentShapes(newShapes);
    
    // Update image position if provided
    if (newImagePos && setImagePos) {
      setImagePos(newImagePos);
      lastImagePosRef.current = newImagePos;
    }
    
    // Notify parent
    if (onAnnotationsChange) {
      onAnnotationsChange(newShapes);
    }
  }, [currentShapes, setImagePos, onAnnotationsChange]);

  // Add a new annotation
  const addAnnotation = useCallback((newAnnotation) => {
    // Clip to image boundaries if needed
    let clippedAnnotation = newAnnotation;
    if (konvaImg) {
      clippedAnnotation = clipAnnotationToBoundary(
        newAnnotation,
        konvaImg.width,
        konvaImg.height
      );
      if (!clippedAnnotation) return; // Skip if entirely outside
    }

    updateAnnotationsWithPosition([...currentShapes, clippedAnnotation]);
    
    // Return the index of the newly added annotation
    return currentShapes.length;
  }, [currentShapes, konvaImg, updateAnnotationsWithPosition]);

  // Add multiple annotations at once (for paste operation)
  const addAnnotations = useCallback((newAnnotations) => {
    if (!newAnnotations || newAnnotations.length === 0) return;
    
    // Clip each annotation if needed
    let clippedAnnotations = newAnnotations;
    if (konvaImg) {
      clippedAnnotations = newAnnotations
        .map(ann => clipAnnotationToBoundary(ann, konvaImg.width, konvaImg.height))
        .filter(Boolean); // Remove any that are entirely outside
      
      if (clippedAnnotations.length === 0) return;
    }
    
    updateAnnotationsWithPosition([...currentShapes, ...clippedAnnotations]);
    
    // Select the newly pasted annotations
    const startIndex = currentShapes.length;
    const indices = clippedAnnotations.map((_, i) => startIndex + i);
    setSelectedIndices(indices);
    if (indices.length > 0) {
      setSelectedIndex(indices[0]);
      if (onSelectAnnotation) {
        onSelectAnnotation(indices[0]);
      }
    }
  }, [currentShapes, konvaImg, updateAnnotationsWithPosition, onSelectAnnotation]);

  // Update an existing annotation
  const updateAnnotation = useCallback((index, changes) => {
    if (index < 0 || index >= currentShapes.length) return;

    const updatedShapes = [...currentShapes];
    updatedShapes[index] = { ...updatedShapes[index], ...changes };

    // Clip to image boundaries if needed
    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updatedShapes[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        // Remove if entirely outside
        updatedShapes.splice(index, 1);
        if (selectedAnnotationIndex === index) {
          setSelectedAnnotationIndex(null);
        } else if (selectedAnnotationIndex > index) {
          setSelectedAnnotationIndex(selectedAnnotationIndex - 1);
        }
        
        // Also update multi-selection
        setSelectedIndices(prev => {
          const newIndices = prev.filter(i => i !== index).map(i => i > index ? i - 1 : i);
          return newIndices;
        });
      } else {
        updatedShapes[index] = clipped;
      }
    }

    updateAnnotationsWithPosition(updatedShapes);
  }, [currentShapes, selectedAnnotationIndex, konvaImg, setSelectedAnnotationIndex, updateAnnotationsWithPosition]);

  // Update multiple annotations at once
  const updateMultipleAnnotations = useCallback((indices, changesArray) => {
    if (!indices || !changesArray || indices.length !== changesArray.length) return;
    
    const updatedShapes = [...currentShapes];
    let removedIndices = [];
    
    // Apply changes to each annotation
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const changes = changesArray[i];
      
      if (index < 0 || index >= updatedShapes.length) continue;
      
      updatedShapes[index] = { ...updatedShapes[index], ...changes };
      
      // Clip to image boundaries if needed
      if (konvaImg) {
        const clipped = clipAnnotationToBoundary(
          updatedShapes[index],
          konvaImg.width,
          konvaImg.height
        );
        if (!clipped) {
          // Mark for removal if entirely outside
          removedIndices.push(index);
        } else {
          updatedShapes[index] = clipped;
        }
      }
    }
    
    // Remove annotations that are outside boundaries (in reverse order to preserve indices)
    if (removedIndices.length > 0) {
      removedIndices.sort((a, b) => b - a); // Sort in descending order
      for (const index of removedIndices) {
        updatedShapes.splice(index, 1);
      }
      
      // Update selections
      const newSelectedIndices = selectedAnnotationIndices
        .filter(i => !removedIndices.includes(i))
        .map(i => {
          // Adjust index if it's after a removed index
          let adjustedIndex = i;
          for (const removedIndex of removedIndices) {
            if (adjustedIndex > removedIndex) {
              adjustedIndex--;
            }
          }
          return adjustedIndex;
        });
      
      setSelectedIndices(newSelectedIndices);
      if (newSelectedIndices.length > 0) {
        setSelectedIndex(newSelectedIndices[0]);
        if (onSelectAnnotation) {
          onSelectAnnotation(newSelectedIndices[0]);
        }
      } else {
        setSelectedIndex(null);
        if (onSelectAnnotation) {
          onSelectAnnotation(null);
        }
      }
    }
    
    updateAnnotationsWithPosition(updatedShapes);
  }, [currentShapes, selectedAnnotationIndices, konvaImg, updateAnnotationsWithPosition, onSelectAnnotation]);

  // Move multiple annotations
  const moveMultipleAnnotations = useCallback((deltaX, deltaY) => {
    if (selectedAnnotationIndices.length === 0) return;
    
    const changes = selectedAnnotationIndices.map(index => {
      const ann = currentShapes[index];
      let change = {};
      
      if (ann.type === 'bbox' || ann.type === 'ellipse') {
        change = { x: ann.x + deltaX, y: ann.y + deltaY };
      } else if (ann.type === 'polygon' || ann.type === 'polyline') {
        // Move each point in the polygon/polyline
        const newPoints = ann.points.map(pt => ({
          x: pt.x + deltaX,
          y: pt.y + deltaY
        }));
        change = { points: newPoints };
      }
      
      return change;
    });
    
    updateMultipleAnnotations(selectedAnnotationIndices, changes);
  }, [selectedAnnotationIndices, currentShapes, updateMultipleAnnotations]);

  // Delete an annotation
  const deleteAnnotation = useCallback((index) => {
    if (index < 0 || index >= currentShapes.length) return;

    const updatedShapes = currentShapes.filter((_, i) => i !== index);
    updateAnnotationsWithPosition(updatedShapes);

    // Update selection
    if (selectedAnnotationIndex === index) {
      setSelectedAnnotationIndex(null);
    } else if (selectedAnnotationIndex > index) {
      setSelectedAnnotationIndex(selectedAnnotationIndex - 1);
    }
    
    // Update multiple selection
    setSelectedIndices(prev => {
      const newIndices = prev
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i);
      return newIndices;
    });
  }, [currentShapes, selectedAnnotationIndex, updateAnnotationsWithPosition, setSelectedAnnotationIndex]);

  // Delete multiple annotations
  const deleteMultipleAnnotations = useCallback((indices) => {
    if (!indices || indices.length === 0) return;
    
    // Sort indices in descending order to preserve index validity during deletion
    const sortedIndices = [...indices].sort((a, b) => b - a);
    
    const updatedShapes = [...currentShapes];
    for (const index of sortedIndices) {
      if (index >= 0 && index < updatedShapes.length) {
        updatedShapes.splice(index, 1);
      }
    }
    
    updateAnnotationsWithPosition(updatedShapes);
    
    // Clear selection
    setSelectedAnnotationIndex(null);
    setSelectedIndices([]);
  }, [currentShapes, updateAnnotationsWithPosition, setSelectedAnnotationIndex]);

  // Copy selected annotations
  const copySelectedAnnotations = useCallback(() => {
    if (selectedAnnotationIndices.length === 0) return;
    
    const annotationsToCopy = selectedAnnotationIndices
      .map(index => {
        if (index >= 0 && index < currentShapes.length) {
          return cloneAnnotation(currentShapes[index]);
        }
        return null;
      })
      .filter(Boolean); // Remove any invalid indices
    
    setCopiedAnnotations(annotationsToCopy);
    return annotationsToCopy;
  }, [currentShapes, selectedAnnotationIndices]);

  // Paste copied annotations
  const pasteAnnotations = useCallback((offsetX = 10, offsetY = 10) => {
    if (copiedAnnotations.length === 0) return;
    
    const newAnnotations = copiedAnnotations.map(ann => {
      const newAnn = cloneAnnotation(ann);
      
      // Apply offset to position
      if (newAnn.type === 'bbox' || newAnn.type === 'ellipse') {
        newAnn.x += offsetX;
        newAnn.y += offsetY;
      } else if (newAnn.points) {
        newAnn.points = newAnn.points.map(pt => ({
          x: pt.x + offsetX,
          y: pt.y + offsetY
        }));
      }
      
      return newAnn;
    });
    
    addAnnotations(newAnnotations);
  }, [copiedAnnotations, addAnnotations]);

  // Save the current image position
  const saveImagePosition = useCallback((pos) => {
    // Ensure the position is different before saving to history
    if (!lastImagePosRef.current || 
        (pos.x === lastImagePosRef.current.x && pos.y === lastImagePosRef.current.y)) {
      return;
    }
    
    // Save current state for undo
    setUndoStack(prev => [...prev, {
      shapes: currentShapes,
      imagePos: lastImagePosRef.current
    }]);
    
    // Clear redo stack since we've made a new change
    setRedoStack([]);
    
    // Update reference to current position
    lastImagePosRef.current = pos;
  }, [currentShapes]);

  // Undo the last change (including image position)
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    // Save current state for redo
    setRedoStack(prev => [...prev, {
      shapes: currentShapes,
      imagePos: lastImagePosRef.current
    }]);
    // Pop the last state from undo stack
    setUndoStack(prev => prev.slice(0, -1));
    // Set current shapes to previous state
    setCurrentShapes(previousState.shapes);
    // Set image position to previous state
    if (setImagePos && previousState.imagePos) {
      setImagePos(previousState.imagePos);
      lastImagePosRef.current = previousState.imagePos;
    }
    // Notify parent
    if (onAnnotationsChange) {
      onAnnotationsChange(previousState.shapes);
    }
    
    // Clear selection since the indices may have changed
    setSelectedAnnotationIndex(null);
    setSelectedIndices([]);
  }, [undoStack, currentShapes, setImagePos, onAnnotationsChange, setSelectedAnnotationIndex]);

  // Redo the last undone change (including image position)
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    // Save current state for undo
    setUndoStack(prev => [...prev, {
      shapes: currentShapes,
      imagePos: lastImagePosRef.current
    }]);
    // Pop the last state from redo stack
    setRedoStack(prev => prev.slice(0, -1));
    // Set current shapes to next state
    setCurrentShapes(nextState.shapes);
    // Set image position to next state
    if (setImagePos && nextState.imagePos) {
      setImagePos(nextState.imagePos);
      lastImagePosRef.current = nextState.imagePos;
    }
    // Notify parent
    if (onAnnotationsChange) {
      onAnnotationsChange(nextState.shapes);
    }
    
    // Clear selection since the indices may have changed
    setSelectedAnnotationIndex(null);
    setSelectedIndices([]);
  }, [redoStack, currentShapes, setImagePos, onAnnotationsChange, setSelectedAnnotationIndex]);

  // Find shapes in a region (for marquee selection)
  const findShapesInRegion = useCallback((shapes, region) => {
    if (!shapes || shapes.length === 0) return [];
    
    const { x1, y1, x2, y2 } = region;
    const selectedIndices = [];
    
    shapes.forEach((shape, index) => {
      let isInRegion = false;
      
      if (shape.type === 'bbox') {
        // Check if the bbox overlaps with the region
        const boxX2 = shape.x + shape.width;
        const boxY2 = shape.y + shape.height;
        
        isInRegion = !(boxX2 < x1 || shape.x > x2 || boxY2 < y1 || shape.y > y2);
      } else if (shape.type === 'ellipse') {
        // Check if the ellipse's bounding box overlaps with the region
        const ellipseX1 = shape.x - shape.radiusX;
        const ellipseY1 = shape.y - shape.radiusY;
        const ellipseX2 = shape.x + shape.radiusX;
        const ellipseY2 = shape.y + shape.radiusY;
        
        isInRegion = !(ellipseX2 < x1 || ellipseX1 > x2 || ellipseY2 < y1 || ellipseY1 > y2);
      } else if (shape.type === 'polygon' || shape.type === 'polyline') {
        // Check if any point is inside the region
        if (shape.points && shape.points.length > 0) {
          isInRegion = shape.points.some(pt => 
            pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2
          );
          
          // If no points are inside, check if any line segment crosses the region
          if (!isInRegion && shape.points.length > 1) {
            for (let i = 0; i < shape.points.length - 1; i++) {
              const p1 = shape.points[i];
              const p2 = shape.points[i + 1];
              
              // Check if the line segment intersects any of the region's edges
              if (
                (lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y1) || // Top edge
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x1, y2) || // Left edge
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x2, y1, x2, y2) || // Right edge
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y2, x2, y2))   // Bottom edge
              ) {
                isInRegion = true;
                break;
              }
            }
            
            // If it's a polygon, check the last segment too
            if (!isInRegion && shape.type === 'polygon' && shape.points.length > 2) {
              const p1 = shape.points[shape.points.length - 1];
              const p2 = shape.points[0];
              
              isInRegion = (
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y1) ||
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x1, y2) ||
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x2, y1, x2, y2) ||
                lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y2, x2, y2)
              );
            }
          }
        }
      }
      
      if (isInRegion) {
        selectedIndices.push(index);
      }
    });
    
    return selectedIndices;
  }, []);

  // Helper function to check if two line segments intersect
  function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Calculate the direction of the lines
    const denominator = ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    
    // If the denominator is 0, the lines are parallel
    if (denominator === 0) return false;
    
    const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denominator;
    const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denominator;
    
    // If uA and uB are between 0-1, lines are colliding
    return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
  }

  return {
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
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    findShapesInRegion,
  };
};

export default useAnnotationState;