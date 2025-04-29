import React, { useState, useEffect, useRef } from 'react';

const PolygonPointAdjuster = ({
  annotation,
  index,
  onUpdate,
  onClose,
  stage,
  scale
}) => {
  // Store the original points so we can restore them
  const originalPointsRef = useRef([...annotation.points]);
  const [pointCount, setPointCount] = useState(annotation.points.length);
  const [previewCount, setPreviewCount] = useState(annotation.points.length);
  const [isProcessing, setIsProcessing] = useState(false);
  const adjusterRef = useRef(null);

  // Set reasonable limits based on the original point count
  const minPoints = Math.max(3, Math.floor(originalPointsRef.current.length * 0.3));
  const maxPoints = Math.min(100, Math.ceil(originalPointsRef.current.length * 3));

  // Calculate position near the shape
  const position = (() => {
    // Find the center of the annotation
    let centerX = 0;
    let centerY = 0;

    annotation.points.forEach(pt => {
      centerX += pt.x;
      centerY += pt.y;
    });

    centerX /= annotation.points.length;
    centerY /= annotation.points.length;

    // Convert to stage coordinates
    const stageBox = stage?.container().getBoundingClientRect();
    if (!stageBox) return { left: '50%', top: '10px', transform: 'translateX(-50%)' };

    // Get the group position
    const annoGroup = stage?.findOne('#anno-group');
    if (!annoGroup) return { left: '50%', top: '10px', transform: 'translateX(-50%)' };

    const groupX = annoGroup.x();
    const groupY = annoGroup.y();

    // Convert to absolute position
    const absX = (centerX * scale) + (groupX * scale) + stageBox.left;
    const absY = (centerY * scale) + (groupY * scale) + stageBox.top;

    // Adjust to keep in view
    const panelWidth = 320;
    const panelHeight = 220;

    let left = absX - (panelWidth / 2);
    let top = absY - panelHeight - 20; // 20px offset above the shape

    // Keep in window bounds
    if (left < 10) left = 10;
    if (left + panelWidth > window.innerWidth - 10) left = window.innerWidth - panelWidth - 10;
    if (top < 10) top = absY + 20; // Position below if not enough space above
    if (top + panelHeight > window.innerHeight - 10) top = window.innerHeight - panelHeight - 10;

    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: 'none'
    };
  })();

  // Simple and direct function to adjust point count
  const adjustPoints = (newPointCount) => {
    setIsProcessing(true);
    
    // If we want to restore original points, just do that
    if (newPointCount === originalPointsRef.current.length) {
      onUpdate(index, { points: [...originalPointsRef.current] });
      setPointCount(newPointCount);
      setIsProcessing(false);
      return;
    }
    
    const originalPoints = [...originalPointsRef.current];
    
    // Handle point reduction - simple approach by taking evenly spaced points
    if (newPointCount < originalPoints.length) {
      // Always include the first point for shape preservation
      const result = [originalPoints[0]];
      
      // Calculate the step size needed to get the desired point count
      const step = originalPoints.length / (newPointCount - 1);
      
      // Add evenly spaced points (after the first one we already added)
      for (let i = 1; i < newPointCount - 1; i++) {
        const idx = Math.floor(i * step);
        result.push(originalPoints[idx]);
      }
      
      // Always include the last point to complete the shape
      result.push(originalPoints[originalPoints.length - 1]);
      
      onUpdate(index, { points: result });
      setPointCount(result.length);
    } 
    // Handle point addition - add points between existing points
    else if (newPointCount > originalPoints.length) {
      const result = [...originalPoints];
      
      // Calculate how many points to add
      const pointsToAdd = newPointCount - originalPoints.length;
      
      // Add one point at a time between existing points
      let currentIndex = 0;
      let added = 0;
      
      while (added < pointsToAdd) {
        // Get the two points we'll add between
        const p1 = result[currentIndex];
        const p2 = result[(currentIndex + 1) % result.length];
        
        // Create a new point halfway between them
        const newPoint = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        };
        
        // Insert the new point
        result.splice(currentIndex + 1, 0, newPoint);
        
        // Update counters
        added++;
        currentIndex += 2; // Skip to the next pair
        
        // Wrap around if we reach the end
        if (currentIndex >= result.length) {
          currentIndex = 0;
        }
      }
      
      onUpdate(index, { points: result });
      setPointCount(result.length);
    }
    
    setIsProcessing(false);
  };

  // Preview point count as the slider changes
  const handleSliderChange = (e) => {
    const newCount = parseInt(e.target.value);
    setPreviewCount(newCount);
  };

  // Apply point count changes when slider interaction ends
  const handleSliderEnd = () => {
    if (previewCount !== pointCount && !isProcessing) {
      setPointCount(previewCount);
      adjustPoints(previewCount);
    }
  };

  // Restore original points
  const handleRestoreOriginal = () => {
    setPointCount(originalPointsRef.current.length);
    setPreviewCount(originalPointsRef.current.length);
    onUpdate(index, { points: [...originalPointsRef.current] });
  };

  // Is the current point count original?
  const isOriginal = pointCount === originalPointsRef.current.length;

  return (
    <div
      ref={adjusterRef}
      className="polygon-point-adjuster"
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top,
        transform: position.transform,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '8px',
        padding: '15px',
        zIndex: 1000,
        color: 'white',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        paddingBottom: '10px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Adjust Polygon Points</h3>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '0 5px',
            fontWeight: 'bold'
          }}
        >
          ×
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '14px'
      }}>
        <span>
          Current points: <span style={{ fontWeight: 'bold' }}>{pointCount}</span>
        </span>
        <span style={{
          background: isOriginal ? '#4CAF50' : '#555',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {isOriginal ? 'Original' : 'Modified'}
        </span>
      </div>

      <div>
        <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px' }}>Point Count:</span>
          <span style={{ 
            fontSize: '13px', 
            opacity: 0.7,
            color: isProcessing ? '#FFC107' : 'inherit'
          }}>
            {previewCount}
            {isProcessing && ' (processing...)'}
          </span>
        </div>
        <input
          type="range"
          min={minPoints}
          max={maxPoints}
          value={previewCount}
          onChange={handleSliderChange}
          onMouseUp={handleSliderEnd}
          onTouchEnd={handleSliderEnd}
          style={{
            width: '100%',
            height: '8px',
            appearance: 'none',
            background: 'linear-gradient(to right, #F44336, #FFC107, #4CAF50)',
            outline: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'wait' : 'pointer'
          }}
          disabled={isProcessing}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          opacity: 0.7,
          marginTop: '5px'
        }}>
          <span>Fewer ({minPoints})</span>
          <span>Original ({originalPointsRef.current.length})</span>
          <span>More ({maxPoints})</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleRestoreOriginal}
          style={{
            flex: 1,
            backgroundColor: isOriginal ? '#555' : '#FFC107',
            border: 'none',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            cursor: isOriginal || isProcessing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
            opacity: isOriginal || isProcessing ? 0.7 : 1
          }}
          disabled={isOriginal || isProcessing}
        >
          Restore Original
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            backgroundColor: '#555',
            border: 'none',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PolygonPointAdjuster;