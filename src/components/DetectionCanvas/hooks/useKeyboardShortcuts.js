import { useEffect } from 'react';

/**
 * Custom hook to handle keyboard shortcuts for the canvas
 */
const useKeyboardShortcuts = ({
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
  dispatchToolAction, // This may be undefined, so check before using
  annotations = [],
  selectMultipleAnnotations
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Escape key - Cancel drawing
      if (e.key === 'Escape') {
        if (drawingState.isDrawing) {
          e.preventDefault();
          cancelDrawing();
          
          // Dispatch a custom event for other components
          const event = new CustomEvent('cancel-annotation');
          window.dispatchEvent(event);
        }
        
        // Reset to move tool if dispatchToolAction is available
        if (typeof dispatchToolAction === 'function') {
          try {
            dispatchToolAction('move');
          } catch (err) {
            console.error("Error switching to move tool:", err);
          }
        }
      }
      
      // Delete/Backspace key
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // 1. Delete selected annotations
        if (selectedAnnotationIndices?.length > 0 && !drawingState.isDrawing) {
          e.preventDefault();
          deleteMultipleAnnotations?.(selectedAnnotationIndices);
        } 
        // 2. Delete single selected annotation
        else if (selectedAnnotationIndex !== null && !drawingState.isDrawing) {
          e.preventDefault();
          deleteAnnotation?.(selectedAnnotationIndex);
        }
        // 3. Or remove last point when drawing
        else if (drawingState.isDrawing && drawingState.points?.length > 0) {
          e.preventDefault();
          removeLastPoint?.();
        }
      }
      
      // Copy/Paste functionality
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // Copy selected annotations
        if (selectedAnnotationIndices?.length > 0) {
          e.preventDefault();
          copySelectedAnnotations?.();
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Paste copied annotations
        e.preventDefault();
        // Different offset each time to make them more visible
        const offset = 20;
        pasteAnnotations?.(offset, offset);
      }
      
      // Select all annotations with Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        
        // If selectMultipleAnnotations is available, use it to select all annotations
        if (typeof selectMultipleAnnotations === 'function' && annotations.length > 0) {
          const allIndices = Array.from({ length: annotations.length }, (_, i) => i);
          selectMultipleAnnotations(allIndices, false);
        } else {
          // Fallback: dispatch event
          const event = new CustomEvent('select-all-annotations');
          window.dispatchEvent(event);
        }
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo with Ctrl+Shift+Z
          redo?.();
        } else {
          // Undo with Ctrl+Z
          undo?.();
        }
      }
      
      // Redo alternative with Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo?.();
      }
      
      // Exit polygon drawing mode with Enter key
      if (e.key === 'Enter' && drawingState.isDrawing) {
        if (drawingState.points?.length >= 3 && 
            (drawingState.currentShape?.type === 'polygon' || !drawingState.currentShape)) {
          e.preventDefault();
          const event = new CustomEvent('finish-polygon');
          window.dispatchEvent(event);
        } else if (drawingState.points?.length >= 2 && drawingState.currentShape?.type === 'polyline') {
          e.preventDefault();
          const event = new CustomEvent('finish-polyline');
          window.dispatchEvent(event);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cancelDrawing, 
    deleteAnnotation,
    deleteMultipleAnnotations,
    copySelectedAnnotations,
    pasteAnnotations,
    selectedAnnotationIndex,
    selectedAnnotationIndices,
    drawingState,
    setDrawingState,
    removeLastPoint,
    undo,
    redo,
    dispatchToolAction,
    annotations,
    selectMultipleAnnotations
  ]);
  
  return null; // This hook doesn't return anything, it just adds side effects
};

export default useKeyboardShortcuts;