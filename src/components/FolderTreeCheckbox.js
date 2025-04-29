// src/components/FolderTreeCheckbox.js
import React, { useState } from 'react';
import { FiFolder, FiFile } from 'react-icons/fi';
import './FolderTreeCheckbox.css';

export default function FolderTreeCheckbox({ node, onToggle, parentPath = '' }) {
    const [expanded, setExpanded] = useState(true);
    const [checked, setChecked] = useState(false);
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    const handleCheckboxChange = (e) => {
        const newChecked = e.target.checked;
        setChecked(newChecked);
        onToggle(currentPath, newChecked);
    };

    const handleToggle = (e) => {
        e.stopPropagation(); // Prevent checkbox toggle from triggering expand/collapse
        setExpanded(!expanded);
    };

    const hasChildren =
        node.type === 'folder' && node.children && node.children.length > 0;

    return (
        <div className="folder-tree-checkbox-node">
            <div 
                className="folder-tree-checkbox-label"
                onClick={hasChildren ? handleToggle : null} // Only toggle if folder has children
            >
                {node.type === 'folder' && (
                    <>
                        <span className="toggle-icon">
                            {hasChildren ? (expanded ? '⌄' : '>') : null}
                        </span>
                        <input 
                            type="checkbox" 
                            checked={checked} 
                            onChange={handleCheckboxChange}
                            onClick={(e) => e.stopPropagation()} // Prevent click from toggling folder
                        />
                        <FiFolder className="folder-icon" />
                    </>
                )}
                {node.type !== 'folder' && (
                    <>
                        <input 
                            type="checkbox" 
                            checked={checked} 
                            onChange={handleCheckboxChange}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <FiFile className="file-icon" />
                    </>
                )}
                <span className="node-name">{node.name}</span>
            </div>
            {expanded && hasChildren && (
                <div className="folder-tree-checkbox-children">
                    {node.children.map((child, index) => (
                        <FolderTreeCheckbox
                            key={index}
                            node={child}
                            onToggle={onToggle}
                            parentPath={currentPath}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}