// src/pages/TasksImageHome.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import FolderTreeCheckbox from '../components/FolderTreeCheckbox';
import { FiFolder, FiUsers } from 'react-icons/fi';
import './TasksImageHome.css';

export default function TasksImageHome() {
    const navigate = useNavigate();
    const location = useLocation();
    const [userSession, setUserSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [taskName, setTaskName] = useState('');
    const [annotationType, setAnnotationType] = useState('all');
    const [annotationOptions, setAnnotationOptions] = useState([]);
    const [folderTree, setFolderTree] = useState(null);
    const [selectedFolders, setSelectedFolders] = useState({});
    const [isCreating, setIsCreating] = useState(false);

    const [projectTeam, setProjectTeam] = useState([]);
    const [teamAccess, setTeamAccess] = useState({});

    const [numberOfPoints, setNumberOfPoints] = useState('');
    const [pointLabels, setPointLabels] = useState([]);
    const [showPointsInput, setShowPointsInput] = useState(false);

    useEffect(() => {
        const session = localStorage.getItem('user');
        if (!session) {
            localStorage.setItem('redirectAfterLogin', JSON.stringify({
                path: '/tasks-image-home',
                state: location.state
            }));
            navigate('/signin');
            return;
        }
        const user = JSON.parse(session);
        setUserSession(user);

        // Fetch only projects belonging to this user
        fetch(`http://localhost:4000/api/projects?userId=${user.id}`)
            .then((res) => res.json())
            .then((data) => {
                setProjects(data);
                if (data.length > 0) {
                    setSelectedProject(data[0].project_id);
                }
            })
            .catch((err) => console.error('Error fetching projects:', err));
    }, [navigate, location.state]);

    useEffect(() => {
        if (selectedProject) {
            const project = projects.find((p) => p.project_id === selectedProject);
            if (project) {
                let normalizedType = project.project_type.trim().toLowerCase();
                let options = ["all"];
                if (normalizedType === "image detection") {
                    options = ["all", "bounding box", "polygon", "polyline", "points", "ellipse"];
                } else if (normalizedType === "image segmentation") {
                    options = ["all", "polygon", "instance segmentation", "semantics segmentation", "panoptic segmentation"];
                } else if (normalizedType === "image classification") {
                    options = ["all", "single class", "multi class"];
                } else if (normalizedType === "3d image annotation") {
                    options = ["all", "cuboid"];
                } else if (normalizedType === "video detection") {
                    options = ["all", "bounding box", "polygon", "polyline", "points", "circle"];
                } else if (normalizedType === "video segmentation") {
                    options = ["all", "polygon", "instance segmentation", "semantics segmentation", "panoptic segmentation"];
                } else if (normalizedType === "span annotation") {
                    options = ["all", "normal entity recognition (NER)", "sentiment annotation", "highlighting"];
                } else if (normalizedType === "relation annotation") {
                    options = ["relation annotation"];
                } else if (normalizedType === "document-level annotation") {
                    options = ["all", "text classification", "sentiment analysis"];
                } else if (normalizedType === "key points annotation") {
                    options = ["keypoints(unlimited)", "keypoints(limited)"];
                } else if (normalizedType === "image captioning") {
                    options = ["caption"];
                }
                setAnnotationOptions(options);
                setAnnotationType(options[0]); // Set to first option instead of always "all"

                const parts = project.folder_path.split('/');
                const folderId = parts[1];
                fetch(`http://localhost:4000/api/folder-structure/${folderId}`)
                    .then((res) => res.json())
                    .then((data) => {
                        setFolderTree(data);
                    })
                    .catch((err) => console.error('Error fetching folder structure:', err));
            }
        }
    }, [selectedProject, projects]);

    useEffect(() => {
        if (selectedProject) {
            // Fetch the project team members when a project is selected
            fetch(`http://localhost:4000/api/project-team/${selectedProject}`)
                .then((res) => res.json())
                .then((data) => {
                    setProjectTeam(data);

                    // Initialize access levels for all team members - default to no_access
                    const initialAccess = {};
                    data.forEach(member => {
                        // Project owners automatically get editor access, skip them
                        if (member.role_type !== 'project_owner') {
                            initialAccess[member.user_id] = 'no_access';
                        }
                    });
                    setTeamAccess(initialAccess);
                })
                .catch((err) => console.error('Error fetching project team:', err));
        }
    }, [selectedProject]);

    // Then add this useEffect to reset points-related states when annotation type changes
    useEffect(() => {
        setNumberOfPoints('');
        setPointLabels([]);
        setShowPointsInput(annotationType === 'keypoints(limited)');
    }, [annotationType]);

    // Add this useEffect to generate point label inputs when numberOfPoints changes
    useEffect(() => {
        if (numberOfPoints && !isNaN(numberOfPoints) && parseInt(numberOfPoints) > 0) {
            const num = parseInt(numberOfPoints);
            const newLabels = [...pointLabels];

            // Resize the array to match the number of points
            if (newLabels.length > num) {
                // If we need to shrink the array
                newLabels.length = num;
            } else if (newLabels.length < num) {
                // If we need to grow the array
                for (let i = newLabels.length; i < num; i++) {
                    newLabels.push('');
                }
            }

            setPointLabels(newLabels);
        } else {
            setPointLabels([]);
        }
    }, [numberOfPoints]);

    // Add this function to handle point label changes
    const handlePointLabelChange = (index, value) => {
        const newLabels = [...pointLabels];
        newLabels[index] = value;
        setPointLabels(newLabels);
    };

    // Function to handle access level changes
    const handleAccessChange = (userId, value) => {
        setTeamAccess(prev => ({
            ...prev,
            [userId]: value
        }));
    };

    const handleFolderSelection = (folderPath, isSelected) => {
        setSelectedFolders((prev) => ({
            ...prev,
            [folderPath]: isSelected,
        }));
    };

    const handleNewTask = async () => {
        if (!taskName.trim()) {
            alert("Task Name is required");
            return;
        }
        if (!selectedProject) {
            alert("Project selection is required");
            return;
        }
        if (!annotationType) {
            alert("Annotation Type is required");
            return;
        }
        const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
        if (selectedFolderPaths.length === 0) {
            alert("At least one folder must be selected");
            return;
        }

        // Validate keypoints(limited) specific fields
        if (annotationType === 'keypoints(limited)') {
            if (!numberOfPoints || isNaN(numberOfPoints) || parseInt(numberOfPoints) <= 0) {
                alert("Please enter a valid number of points");
                return;
            }

            // Check if all point labels are filled
            if (pointLabels.some(label => !label.trim())) {
                alert("Please provide labels for all points");
                return;
            }
        }

        setIsCreating(true);
        const userId = userSession.id;
        const project = projects.find(p => p.project_id === selectedProject);
        const projectName = project ? project.project_name : "";

        const payload = {
            userId,
            projectId: selectedProject,
            taskName: taskName.trim(),
            projectName,
            annotationType,
            selectedFolders,
            teamAccess,
            created_at: new Date().toISOString()
        };

        try {
            const res = await fetch('http://localhost:4000/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                const taskId = data.taskId;

                // For keypoints(limited), save point configuration to a file
                if (annotationType === 'keypoints(limited)') {
                    const project = projects.find(p => p.project_id === selectedProject);
                    if (project) {
                        const folderPath = project.folder_path.split('/')[1]; // Get folder ID

                        const keypointsData = {
                            numberOfPoints: parseInt(numberOfPoints),
                            pointLabels: pointLabels
                        };

                        const keypointsRes = await fetch(`http://localhost:4000/api/keypoints-config`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                folderId: folderPath,
                                taskId: taskId,
                                keypointsData
                            })
                        });

                        if (!keypointsRes.ok) {
                            console.error('Error saving keypoints configuration');
                        }
                    }
                }

                alert(`Task "${taskName}" created successfully with ID: ${taskId}`);
                navigate('/tasks');
            } else {
                const errorData = await res.json();
                alert("Error creating task: " + (errorData.error || "Unknown error"));
            }
        } catch (err) {
            console.error('Error creating task:', err);
            alert("Error creating task: " + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="tasks-image-home-page">
            <UserHomeTopBar />
            <div className="tasks-image-home-container">
                <h2>
                    <FiFolder className="header-icon" />
                    Create New Task
                </h2>
                <div className="form-area">
                    <label>Task Name</label>
                    <input
                        type="text"
                        placeholder="Enter task name (e.g. Review Documents)"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                    />
                </div>
                <div className="form-area">
                    <label>Select Project</label>
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                    >
                        {projects.length === 0 ? (
                            <option value="">No projects available</option>
                        ) : (
                            projects.map((project) => (
                                <option key={project.project_id} value={project.project_id}>
                                    {project.project_name}
                                </option>
                            ))
                        )}
                    </select>
                </div>
                <div className="form-area">
                    <label>Annotation Type</label>
                    <select
                        value={annotationType}
                        onChange={(e) => setAnnotationType(e.target.value)}
                    >
                        {annotationOptions.map((option, index) => (
                            <option key={index} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Keypoints(limited) specific fields */}
                {showPointsInput && (
                    <div className="form-area">
                        <label>Enter Number of Points</label>
                        <input
                            type="number"
                            placeholder="Enter number"
                            value={numberOfPoints}
                            onChange={(e) => setNumberOfPoints(e.target.value)}
                            min="1"
                        />
                    </div>
                )}

                {/* Point Labels */}
                {showPointsInput && numberOfPoints && !isNaN(numberOfPoints) && parseInt(numberOfPoints) > 0 && (
                    <div className="form-area points-section">
                        <h3>Points Added:</h3>
                        <div className="points-list">
                            {pointLabels.map((label, idx) => (
                                <div className="point-label-row" key={idx}>
                                    <label>Point {idx + 1}:</label>
                                    <input
                                        type="text"
                                        placeholder={`Label for point ${idx + 1}`}
                                        value={label}
                                        onChange={(e) => handlePointLabelChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {projectTeam.length > 0 && (
                    <div className="form-area">
                        <label>Team Access Control</label>
                        <div className="team-access-container">
                            {projectTeam
                                // Filter out project owners, as they automatically get editor access
                                .filter(member => member.role_type !== 'project_owner')
                                .map((member) => (
                                    <div key={member.user_id} className="team-member-row">
                                        <div className="team-member-info">
                                            <div className="team-member-avatar">
                                                {member.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="team-member-details">
                                                <span className="team-member-name">{member.username}</span>
                                                <span className="team-member-role">{member.role_type.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        <div className="access-control-dropdown">
                                            <select
                                                value={teamAccess[member.user_id] || 'no_access'}
                                                onChange={(e) => handleAccessChange(member.user_id, e.target.value)}
                                            >
                                                <option value="no_access">No Access</option>
                                                <option value="viewer">Viewer</option>
                                                <option value="editor">Editor</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            {projectTeam.filter(member => member.role_type !== 'project_owner').length === 0 && (
                                <p className="no-team-members">No team members found for this project.</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="folder-tree-section">
                    <h3>Select Folders</h3>
                    {folderTree ? (
                        <FolderTreeCheckbox
                            node={folderTree}
                            onToggle={handleFolderSelection}
                        />
                    ) : (
                        <div className="no-folders">
                            <p>No folder structure available for this project.</p>
                        </div>
                    )}
                </div>
                <div className="buttons-row">
                    <button
                        className="new-task-btn"
                        onClick={handleNewTask}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <span className="loading-spinner">Creating...</span>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create Task
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}