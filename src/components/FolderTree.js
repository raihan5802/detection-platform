import React, { useState } from 'react';
import './FolderTree.css';

export default function FolderTree({ node }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

    return (
        <div className="folder-tree-node">
            <div className="folder-tree-label" onClick={() => setExpanded(!expanded)}>
                {node.type === 'folder' && (
                    <span className="toggle-icon">{expanded ? '⌄' : '>'}</span>
                )}
                <span>{node.name}</span>
            </div>
            {expanded && hasChildren && (
                <div className="folder-tree-children">
                    {node.children.map((child, index) => (
                        <FolderTree key={index} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
}
