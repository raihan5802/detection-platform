import React from 'react';

const PointReductionPanel = ({
  originalPoints,
  currentPoints,
  distanceThreshold,
  onThresholdChange,
  onApply,
  onCancel
}) => {
  return (
    <div
      className="point-reduction-panel"
      style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        padding: '10px',
        zIndex: 1000,
        color: 'white',
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Reduce Points: {originalPoints.length} →
          <span style={{ color: originalPoints.length !== currentPoints.length ? '#FFC107' : 'white' }}>
            {currentPoints.length}
          </span>
        </span>
        <button
          onClick={onCancel}
          style={{
            backgroundColor: '#f44336',
            border: 'none',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
      <div>
        <input
          type="range"
          min="5"
          max="100"
          value={distanceThreshold}
          onChange={onThresholdChange}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Less Points</span>
          <span>More Points</span>
        </div>
      </div>
      <button
        onClick={onApply}
        style={{
          backgroundColor: '#4CAF50',
          border: 'none',
          color: 'white',
          padding: '8px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Apply
      </button>
    </div>
  );
};

export default PointReductionPanel;