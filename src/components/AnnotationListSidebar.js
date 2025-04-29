// AnnotationListSidebar.js

import React, { useState, useEffect } from 'react';
import './AnnotationListSidebar.css';

// SVG Icons
const OpacityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
    <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

export default function AnnotationListSidebar({
  annotations,
  onDeleteAnnotation,
  onUpdateAnnotation,
  labelClasses,
  selectedAnnotationIndex,
  setSelectedAnnotationIndex,
  currentShapes,
  onUpdateAllAnnotations,
}) {
  // State for global opacity value
  const [globalOpacityValue, setGlobalOpacityValue] = useState(55);

  // Handle label dropdown changes for a specific annotation
  const handleLabelDropdown = (idx, newLabel) => {
    const labelColor =
      labelClasses.find((lc) => lc.name === newLabel)?.color || '#ff0000';

    onUpdateAnnotation(idx, { label: newLabel, color: labelColor });
  };

  // Handle click on annotation to select it
  const handleAnnotationClick = (idx) => {
    if (selectedAnnotationIndex === idx) {
      setSelectedAnnotationIndex(null);
    } else {
      setSelectedAnnotationIndex(idx);
    }
  };

  // Handle global opacity change
  const handleGlobalOpacityChange = (value) => {
    setGlobalOpacityValue(value);
    const decimal = value / 100;

    if (selectedAnnotationIndex !== null) {
      // Update only the selected annotation
      onUpdateAnnotation(selectedAnnotationIndex, { opacity: decimal });
    } else {
      // Update all annotations at once
      const updatedAnnotations = annotations.map((ann) => ({
        ...ann,
        opacity: decimal,
      }));
      onUpdateAllAnnotations(updatedAnnotations);
    }
  };

  // Update global opacity slider when selected annotation changes
  useEffect(() => {
    if (selectedAnnotationIndex !== null && currentShapes[selectedAnnotationIndex]) {
      const currentOpacity = currentShapes[selectedAnnotationIndex].opacity !== undefined
        ? Math.round(currentShapes[selectedAnnotationIndex].opacity * 100)
        : 55; // Use 55 as fallback if opacity is undefined
      setGlobalOpacityValue(currentOpacity);
    } else {
      // If no annotation is selected, check if all annotations have the same opacity
      if (annotations.length > 0) {
        const opacities = annotations.map(ann => ann.opacity !== undefined ? Math.round(ann.opacity * 100) : 55);
        const allSame = opacities.every(opacity => opacity === opacities[0]);
        setGlobalOpacityValue(allSame ? opacities[0] : 55);
      } else {
        setGlobalOpacityValue(55);
      }
    }
  }, [selectedAnnotationIndex, currentShapes, annotations]);

  return (
    <div className="anno-sidebar">
      <h3>Annotations</h3>
      {annotations.length === 0 && <p>No annotations yet.</p>}
      {annotations.map((ann, i) => {
        const label = ann.label || '';
        const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;
        const opacityPercent = Math.round(opacity * 100);

        return (
          <div
            key={i}
            className={`anno-item ${selectedAnnotationIndex === i ? 'active' : ''}`}
            onClick={() => handleAnnotationClick(i)}
          >
            <div>
              <span className="shape-type">{ann.type.toUpperCase()}</span>{' '}
              <span className="shape-label">{label}</span>
              {opacityPercent !== 100 && (
                <span className="opacity-label">({opacityPercent}%)</span>
              )}
              {ann.instanceId && (
                <span style={{ marginLeft: 8 }}>({ann.instanceId})</span>
              )}
            </div>
            <div className="anno-actions">
              <select
                value={label}
                onChange={(e) => handleLabelDropdown(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {labelClasses.map((lc, idx2) => (
                  <option key={idx2} value={lc.name}>
                    {lc.name}
                  </option>
                ))}
              </select>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteAnnotation(i);
                }}
                className="delete-button"
              >
                Del
              </button>
            </div>
          </div>
        );
      })}

      {/* Appearance Section */}
      <div className="appearance-section">
        <h3>Appearance</h3>
        <div className="appearance-control">
          <div className="appearance-label">
            <OpacityIcon />
            <span>
              {selectedAnnotationIndex !== null
                ? "Selected Annotation Opacity"
                : "Global Opacity"}
            </span>
          </div>
          <div className="opacity-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={globalOpacityValue}
              onChange={(e) => handleGlobalOpacityChange(parseInt(e.target.value))}
              className="opacity-slider"
            />
            <div className="opacity-value">{globalOpacityValue}%</div>
          </div>
          {selectedAnnotationIndex !== null && (
            <div className="preview-box"
              style={{
                backgroundColor: currentShapes[selectedAnnotationIndex]?.color || '#000000',
                opacity: globalOpacityValue / 100
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}