// src/components/SelectedFilesTree.js
import React, { useState } from 'react';
import './SelectedFilesTree.css';

export default function SelectedFilesTree({ node }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="selected-files-node">
            <div className="node-label" onClick={() => setExpanded(!expanded)}>
                {node.name} {hasChildren && (expanded ? '⌄' : '>')}
            </div>
            {expanded && hasChildren && (
                <div className="node-children">
                    {node.children.map((child, index) => (
                        <SelectedFilesTree key={index} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
}
