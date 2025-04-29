import React, { useState, useEffect } from 'react';
import './AnnotationTopBar.css';

// A dedicated, accessible modal component for keyboard shortcuts
function KeyboardShortcutsModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
        <div className="shortcuts-content">
          <h3>General</h3>
          <table>
            <tbody>
              <tr>
                <td>Cancel Annotation</td>
                <td>Esc</td>
              </tr>
              <tr>
                <td>Next Image</td>
                <td>&gt;</td>
              </tr>
              <tr>
                <td>Previous Image</td>
                <td>&lt;</td>
              </tr>
              <tr>
                <td>Tools to select annotation</td>
                <td>M / B / P / L / O / E / S</td>
              </tr>
              <tr>
                <td>Save annotation</td>
                <td>Ctrl + S</td>
              </tr>
              <tr>
                <td>Undo</td>
                <td>Ctrl + Z</td>
              </tr>
              <tr>
                <td>Redo</td>
                <td>Ctrl + Y</td>
              </tr>
            </tbody>
          </table>
          <h3>Annotation</h3>
          <table>
            <tbody>
              <tr>
                <td>
                  Delete point (Polygon, Polyline, Points, Segmentation)
                </td>
                <td>Double Click on point</td>
              </tr>
              <tr>
                <td>
                  Add point (Polygon, Polyline, Points, Segmentation)
                </td>
                <td>Single Click on point</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button className="close-modal" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function AnnotationTopBar({
  onHome,
  onPrev,
  onNext,
  onSave,
  onZoomIn,
  onZoomOut,
  onExport,
  currentIndex,
  total,
  taskName
}) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="anno-topbar">
      <div className="left-buttons">
        <button onClick={onHome}>Home</button>
        <button onClick={onPrev} disabled={currentIndex <= 0}>
          Prev
        </button>
        <button onClick={onNext} disabled={currentIndex >= total - 1}>
          Next
        </button>
        {/* Changed the label to indicate it's Ctrl+S */}
        <button onClick={onSave}>Save (Ctrl+S)</button>
        <button onClick={onExport}>Export</button>
        {/* New Keyboard Shortcuts button */}
        <button onClick={() => setShowShortcuts(true)}>
          Keyboard Shortcuts
        </button>
      </div>
      <div className="middle-info">
        {taskName && <span className="task-name">Task: {taskName}</span>}
      </div>
      <div className="right-buttons">
        <button onClick={onZoomOut}>- Zoom</button>
        <button onClick={onZoomIn}>+ Zoom</button>
        <span className="img-count">
          {currentIndex + 1} / {total}
        </span>
      </div>
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
