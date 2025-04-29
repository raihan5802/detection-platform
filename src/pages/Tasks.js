import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import { FiEdit2, FiEye } from 'react-icons/fi';
import './Tasks.css';

function Tasks() {
    const navigate = useNavigate();
    const location = useLocation(); // Add this line
    const searchParams = new URLSearchParams(location.search); // Add this line
    const projectId = searchParams.get('projectId'); // Define projectId here

    const [tasks, setTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('newest');
    const [userSession, setUserSession] = useState(null);

    const [projectName, setProjectName] = useState("");

    // useEffect(() => {
    //     // Check for user session and redirect if not logged in
    //     const userSessionData = localStorage.getItem('user');
    //     if (!userSessionData) {
    //         localStorage.setItem('redirectAfterLogin', JSON.stringify({ path: '/tasks' }));
    //         navigate('/signin');
    //         return;
    //     }
    //     const user = JSON.parse(userSessionData);
    //     setUserSession(user);

    //     const fetchTasks = async () => {
    //         try {
    //             setLoading(true);
    //             // Pass the user ID to filter tasks
    //             const res = await fetch(`http://localhost:4000/api/tasks?userId=${user.id}`);
    //             if (res.ok) {
    //                 const data = await res.json();
    //                 const updatedTasks = await Promise.all(
    //                     data.map(async (task) => {
    //                         const folderPaths = task.selected_files.split(';').filter(Boolean);
    //                         if (folderPaths.length > 0) {
    //                             const chosenFolder = folderPaths[0];
    //                             try {
    //                                 const imageRes = await fetch(
    //                                     `http://localhost:4000/api/first-image?folderPath=${encodeURIComponent(chosenFolder)}`
    //                                 );
    //                                 if (imageRes.ok) {
    //                                     const imageData = await imageRes.json();
    //                                     task.thumbnailUrl = `http://localhost:4000/${imageData.imageUrl}`;
    //                                 } else {
    //                                     task.thumbnailUrl = generateTextThumbnail(task.task_name);
    //                                 }
    //                             } catch (error) {
    //                                 console.error('Error fetching thumbnail for task', task.task_id, error);
    //                                 task.thumbnailUrl = generateTextThumbnail(task.task_name);
    //                             }
    //                         } else {
    //                             task.thumbnailUrl = generateTextThumbnail(task.task_name);
    //                         }
    //                         return task;
    //                     })
    //                 );
    //                 setTasks(updatedTasks);
    //             } else {
    //                 console.error('Failed to fetch tasks');
    //             }
    //         } catch (error) {
    //             console.error('Error fetching tasks:', error);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     fetchTasks();
    // }, [navigate]);

    useEffect(() => {
        // Check for user session and redirect if not logged in
        const userSessionData = localStorage.getItem('user');
        if (!userSessionData) {
            localStorage.setItem('redirectAfterLogin', JSON.stringify({ path: '/tasks' }));
            navigate('/signin');
            return;
        }
        const user = JSON.parse(userSessionData);
        setUserSession(user);

        // Extract projectId from URL query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const projectId = searchParams.get('projectId');

        const fetchTasks = async () => {
            try {
                setLoading(true);
                // Pass the user ID to filter tasks
                let url = `http://localhost:4000/api/tasks?userId=${user.id}`;
                if (projectId) {
                    url += `&projectId=${projectId}`;
                }

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();

                    // Filter tasks by projectId if present in the URL
                    const filteredData = projectId
                        ? data.filter(task => task.project_id === projectId)
                        : data;

                    const updatedTasks = await Promise.all(
                        filteredData.map(async (task) => {
                            // Rest of your existing task data processing code...
                            const folderPaths = task.selected_files.split(';').filter(Boolean);
                            if (folderPaths.length > 0) {
                                const chosenFolder = folderPaths[0];
                                try {
                                    const imageRes = await fetch(
                                        `http://localhost:4000/api/first-image?folderPath=${encodeURIComponent(chosenFolder)}`
                                    );
                                    if (imageRes.ok) {
                                        const imageData = await imageRes.json();
                                        task.thumbnailUrl = `http://localhost:4000/${imageData.imageUrl}`;
                                    } else {
                                        task.thumbnailUrl = generateTextThumbnail(task.task_name);
                                    }
                                } catch (error) {
                                    console.error('Error fetching thumbnail for task', task.task_id, error);
                                    task.thumbnailUrl = generateTextThumbnail(task.task_name);
                                }
                            } else {
                                task.thumbnailUrl = generateTextThumbnail(task.task_name);
                            }
                            return task;
                        })
                    );
                    setTasks(updatedTasks);
                } else {
                    console.error('Failed to fetch tasks');
                }
            } catch (error) {
                console.error('Error fetching tasks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [navigate]);

    // Add this to your useEffect hook right after getting the projectId
    if (projectId) {
        // Fetch project name if a projectId is provided
        const fetchProjectName = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/projects/${projectId}`);
                if (res.ok) {
                    const project = await res.json();
                    setProjectName(project.project_name);
                }
            } catch (error) {
                console.error('Error fetching project details:', error);
            }
        };
        fetchProjectName();
    }

    const generateTextThumbnail = (taskName) => {
        // Generate a consistent color based on the task name
        const stringToColor = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF)
                .toString(16)
                .toUpperCase()
                .padStart(6, '0');
            return `#${c}`;
        };

        const baseColor = stringToColor(taskName);
        const darkerColor = adjustColor(baseColor, -30);
        const lighterColor = adjustColor(baseColor, 30);

        // Get first letter of each word for the initials
        const getInitials = (name) => {
            return name
                .split(' ')
                .map(word => word.charAt(0).toUpperCase())
                .join('')
                .substring(0, 3);
        };

        const taskInitials = getInitials(taskName);
        const truncatedName = taskName.length > 25 ? taskName.substring(0, 22) + '...' : taskName;

        function adjustColor(color, amount) {
            return '#' + color.replace(/^#/, '').replace(/../g, color =>
                ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).slice(-2)
            );
        }

        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220" viewBox="0 0 300 220">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${encodeURIComponent(lighterColor)}" stop-opacity="0.8"/>
                    <stop offset="100%" stop-color="${encodeURIComponent(darkerColor)}" stop-opacity="0.9"/>
                </linearGradient>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000" flood-opacity="0.3"/>
                </filter>
            </defs>
            <rect width="300" height="220" rx="12" fill="url(%23grad)" filter="url(%23shadow)"/>
            
            <circle cx="150" cy="85" r="45" fill="white" fill-opacity="0.15"/>
            <text x="150" y="105" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${taskInitials}</text>
            
            <rect x="40" y="150" width="220" height="2" rx="1" fill="white" fill-opacity="0.2"/>
            
            <text x="150" y="180" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${encodeURIComponent(truncatedName)}</text>
            
            <g opacity="0.7">
                <rect x="60" y="30" width="50" height="8" rx="4" fill="white" fill-opacity="0.3"/>
                <rect x="120" y="30" width="120" height="8" rx="4" fill="white" fill-opacity="0.3"/>
                <rect x="40" y="50" width="90" height="8" rx="4" fill="white" fill-opacity="0.3"/>
                <rect x="140" y="50" width="70" height="8" rx="4" fill="white" fill-opacity="0.3"/>
                <rect x="220" y="50" width="40" height="8" rx="4" fill="white" fill-opacity="0.3"/>
            </g>
        </svg>`;
    };

    const sortTasks = (tasksList) => {
        switch (sortBy) {
            case 'newest':
                return [...tasksList].sort(
                    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
                );
            case 'oldest':
                return [...tasksList].sort(
                    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
                );
            case 'name':
                return [...tasksList].sort((a, b) =>
                    a.task_name.localeCompare(b.task_name)
                );
            case 'nameDesc':
                return [...tasksList].sort((a, b) =>
                    b.task_name.localeCompare(a.task_name)
                );
            default:
                return tasksList;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'No date available';
        const date = new Date(dateString.trim()); // trim extra whitespace/CR
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const renderTaskCard = (task) => {
        // Determine if this is a text annotation task (no image)
        const isTextAnnotation = !task.thumbnailUrl || task.thumbnailUrl.includes('data:image/svg+xml');

        // Create a random progress for demonstration
        const randomProgress = Math.floor(Math.random() * 100);

        return (
            <div
                key={task.task_id}
                className="task-card"
                onClick={() => navigate(`/task-info/${task.task_id}`)}
            >
                <div className="task-image">
                    <img
                        src={task.thumbnailUrl}
                        alt={task.task_name}
                        className={isTextAnnotation ? "text-thumbnail" : "thumbnail-glow"}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = generateTextThumbnail(task.task_name);
                        }}
                    />
                    {isTextAnnotation && <div className="text-thumbnail-overlay"></div>}
                    <div className="task-overlay">
                        <span className="task-icon">{isTextAnnotation ? "📝" : "🖼️"}</span>
                    </div>

                    {task.access_level && (
                        <div className="task-access-badge">
                            {task.access_level === 'editor' ? (
                                <span className="access-editor">
                                    <FiEdit2 /> Editor
                                </span>
                            ) : (
                                <span className="access-viewer">
                                    <FiEye /> Viewer
                                </span>
                            )}
                        </div>
                    )}

                    <div className="task-type-indicator">
                        <span className="type-icon">{isTextAnnotation ? "📄" : "🖼️"}</span>
                        <span className="task-type-text">
                            {isTextAnnotation ? "Text Annotation" : "Image Annotation"}
                        </span>
                    </div>
                </div>
                <div className="task-details">
                    <h3 className="task-name" title={task.task_name}>
                        {task.task_name}
                    </h3>
                    <div className="task-meta">
                        <span className="task-meta-item">
                            <span className="meta-icon">📅</span>
                            {formatDate(task.created_at)}
                        </span>
                        {isTextAnnotation && (
                            <span className="task-meta-item">
                                <span className="meta-icon">📊</span>
                                Text Data
                            </span>
                        )}
                    </div>
                    <div className="task-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${randomProgress}%` }}
                            ></div>
                        </div>
                        <div className="progress-stats">
                            <span>Progress</span>
                            <span>{randomProgress}%</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    let filteredTasks = tasks.filter(task =>
        task.task_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    filteredTasks = sortTasks(filteredTasks);

    return (
        <div className="tasks-page">
            <UserHomeTopBar />
            <div className="tasks-container">
                <div className="tasks-header">
                    <h1>{projectId ? `Tasks for ${projectName}` : 'Your Tasks'}</h1>
                    <p>
                        {projectId
                            ? `View and manage tasks for the project "${projectName}"`
                            : 'Explore and manage your annotation tasks'}
                    </p>
                </div>

                <div className="controls-container">
                    <div className="search-bar-container">
                        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="filter-sort-container">
                        <div className="sort-dropdown">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="sort-select"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="name">Name (A-Z)</option>
                                <option value="nameDesc">Name (Z-A)</option>
                            </select>
                        </div>

                        <button
                            className="new-task-btn"
                            onClick={() => navigate('/tasks-image-home')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            New Task
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading tasks...</p>
                    </div>
                ) : (
                    <>
                        {filteredTasks.length > 0 ? (
                            <div className="tasks-grid">
                                {filteredTasks.map(task => renderTaskCard(task))}
                            </div>
                        ) : (
                            <div className="no-tasks-container">
                                <div className="empty-state-text-annotation">
                                    <div className="icon-container">
                                        <span className="text-annotation-icon">📝</span>
                                    </div>
                                    <h3>No tasks found</h3>
                                    <p>
                                        {searchTerm
                                            ? "Try adjusting your search terms"
                                            : "Start by creating your first annotation task"}
                                    </p>
                                    <button
                                        className="create-first-task-btn"
                                        onClick={() => navigate('/tasks-image-home')}
                                    >
                                        Create New Task
                                    </button>

                                    <div className="annotation-hint">
                                        <h4>About Text Annotation</h4>
                                        <p>
                                            Text annotation tasks help organize and label your text data for better analysis.
                                            Perfect for sentiment analysis, content categorization, and knowledge extraction.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Tasks;