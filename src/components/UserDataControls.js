// UserDataControls.js - Updated with role-based permissions
import React, { useState, useEffect } from 'react';
import { FiToggleRight, FiToggleLeft, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import './UserDataControls.css';

const UserDataControls = ({ projectId, userId, username, userFolder, onUpdate, userRole }) => {
    const [isEnabled, setIsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Fetch initial state on component mount
    useEffect(() => {
        const fetchDataState = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/data-access/${projectId}/${userFolder}`);
                if (res.ok) {
                    const data = await res.json();
                    setIsEnabled(data.isEnabled);
                }
            } catch (error) {
                console.error('Error fetching data access state:', error);
            }
        };

        fetchDataState();
    }, [projectId, userFolder]);

    const handleToggleAccess = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:4000/api/data-access/${projectId}/${userFolder}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isEnabled: !isEnabled })
            });

            if (res.ok) {
                setIsEnabled(!isEnabled);
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error('Error toggling data access:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:4000/api/data-access/${projectId}/${userFolder}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setShowDeleteConfirm(false);
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error('Error deleting user data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get upload date in readable format
    const getFormattedDate = () => {
        const datePart = userFolder.split('_')[1];
        if (datePart && datePart.length === 8) {
            return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
        return 'Unknown date';
    };

    return (
        <div className="user-data-controls">
            <div className="user-info">
                <div className="user-avatar">{username ? username.charAt(0).toUpperCase() : 'U'}</div>
                <div className="user-details">
                    <span className="username">
                        {username || 'Unknown User'}
                        {userRole === 'data_provider' && <span className="current-user-badge">(You)</span>}
                    </span>
                    <span className="upload-info">Uploaded on {getFormattedDate()}</span>
                </div>
            </div>

            <div className="control-actions">
                <div className="toggle-control">
                    <button
                        className={`toggle-button ${isEnabled ? 'enabled' : 'disabled'}`}
                        onClick={handleToggleAccess}
                        disabled={isLoading}
                        title={isEnabled ? 'Disable access to this data' : 'Enable access to this data'}
                    >
                        {isEnabled ? <FiToggleRight /> : <FiToggleLeft />}
                        <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                </div>

                <div className="delete-control">
                    {!showDeleteConfirm ? (
                        <button
                            className="delete-button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isLoading}
                            title="Delete this user's data"
                        >
                            <FiTrash2 />
                            <span>Delete Data</span>
                        </button>
                    ) : (
                        <div className="delete-confirmation">
                            <FiAlertTriangle className="warning-icon" />
                            <span>Are you sure?</span>
                            <button
                                className="confirm-delete"
                                onClick={handleDeleteData}
                                disabled={isLoading}
                            >
                                Yes, Delete
                            </button>
                            <button
                                className="cancel-delete"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDataControls;