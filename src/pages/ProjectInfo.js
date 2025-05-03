// src/pages/ProjectInfo.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './ProjectInfo.css';
import UserDataControls from '../components/UserDataControls'; // for data provider data access

// Import icons - you'll need to install react-icons package
import {
    FiFolder,
    FiFile,
    FiTag,
    FiPlusCircle,
    FiUploadCloud,
    FiCheckSquare,
    FiInfo,
    FiX,
    FiGrid,
    FiChevronRight,
    FiEdit,
    FiCalendar,
    FiUsers,
    FiUserPlus,
    FiUpload,
    FiDatabase
} from 'react-icons/fi';


// A set of candidate colors to choose from.
const candidateColors = [
    '#FF5733', '#33FF57', '#3357FF', '#F1C40F',
    '#8E44AD', '#1ABC9C', '#E74C3C', '#2ECC71',
    '#3498DB', '#9B59B6'
];

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(ch => ch + ch).join('');
    }
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

function colorDistance(hex1, hex2) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

function getSuggestedColor(existingColors) {
    // If there are no existing colors, return the first candidate.
    if (existingColors.length === 0) return candidateColors[0];

    let bestCandidate = candidateColors[0];
    let bestDistance = 0;
    candidateColors.forEach(candidate => {
        let minDistance = Infinity;
        existingColors.forEach(existing => {
            const d = colorDistance(candidate, existing);
            if (d < minDistance) {
                minDistance = d;
            }
        });
        if (minDistance > bestDistance) {
            bestDistance = minDistance;
            bestCandidate = candidate;
        }
    });
    return bestCandidate;
}

// Enhanced FolderTree component with icons
const EnhancedFolderTree = ({ node }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!node) return null;

    if (node.type === 'folder') {
        return (
            <li>
                <div className="folder-node">
                    <span
                        className={`folder-toggle ${isOpen ? 'open' : ''}`}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <FiChevronRight />
                    </span>
                    <span className="folder-icon"><FiFolder /></span>
                    <span className="folder-name" onClick={() => setIsOpen(!isOpen)}>
                        {node.name}
                    </span>
                </div>
                {isOpen && node.children && (
                    <ul>
                        {node.children.map((child, index) => (
                            <EnhancedFolderTree key={index} node={child} />
                        ))}
                    </ul>
                )}
            </li>
        );
    } else {
        return (
            <li>
                <div className="file-node">
                    <span className="file-icon"><FiFile /></span>
                    <span className="file-name">{node.name}</span>
                </div>
            </li>
        );
    }
};

export default function ProjectInfo() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [project, setProject] = useState(null);
    const [folderTree, setFolderTree] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddLabelForm, setShowAddLabelForm] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [suggestedColor, setSuggestedColor] = useState('');
    const [userSession, setUserSession] = useState(null);
    const [unauthorized, setUnauthorized] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const [dataProviders, setDataProviders] = useState([]);
    const [collaborators, setCollaborators] = useState([]);

    const [userDataFolders, setUserDataFolders] = useState([]);

    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [currentDataProviderEmail, setCurrentDataProviderEmail] = useState('');
    const [currentCollaboratorEmail, setCurrentCollaboratorEmail] = useState('');
    const [newDataProviders, setNewDataProviders] = useState([]);
    const [newCollaborators, setNewCollaborators] = useState([]);
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionType, setSuggestionType] = useState(null);
    const [validationErrors, setValidationErrors] = useState({
        dataProvider: '',
        collaborator: ''
    });

    // Add this state variable with the other state variables at the top of your component
    const [availableUsers, setAvailableUsers] = useState([]);

    // First fetch the user session
    useEffect(() => {
        const session = localStorage.getItem('user');
        if (!session) {
            localStorage.setItem('redirectAfterLogin', JSON.stringify({
                path: `/project-info/${projectId}`
            }));
            navigate('/signin');
            return;
        }
        const user = JSON.parse(session);
        setUserSession(user);

        // Get user role from location state if available
        if (location.state && location.state.userRole) {
            setUserRole(location.state.userRole);
        }
    }, [navigate, projectId, location.state]);

    // Fetch project details.
    useEffect(() => {
        if (!userSession) return;

        const fetchProject = async () => {
            try {
                // First check if user has access to this project
                const rolesRes = await fetch(`http://localhost:4000/api/project-role/${projectId}/${userSession.id}`);
                if (rolesRes.ok) {
                    const roleData = await rolesRes.json();
                    if (!roleData.role) {
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }

                    // If role wasn't set from location state, set it now
                    if (!userRole) {
                        setUserRole(roleData.role);
                    }

                    // Fetch project details
                    const projectRes = await fetch(`http://localhost:4000/api/projects/${projectId}`);
                    if (projectRes.ok) {
                        const projectData = await projectRes.json();
                        setProject(projectData);
                    } else {
                        console.error('Failed to fetch project');
                        setUnauthorized(true);
                    }
                } else {
                    console.error('Failed to check project access');
                    setUnauthorized(true);
                }
            } catch (error) {
                console.error('Error fetching project:', error);
                setUnauthorized(true);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [projectId, userSession, userRole]);

    // Fetch folder tree once project is loaded.
    useEffect(() => {
        if (project) {
            const parts = project.folder_path.split('/');
            const folderId = parts[1];
            const fetchFolderTree = async () => {
                try {
                    const res = await fetch(`http://localhost:4000/api/folder-structure/${folderId}`);
                    if (res.ok) {
                        const treeData = await res.json();
                        setFolderTree(treeData);
                    } else {
                        console.error('Failed to fetch folder structure');
                    }
                } catch (error) {
                    console.error('Error fetching folder structure:', error);
                }
            };
            fetchFolderTree();
        }
    }, [project]);

    // When the add-label modal is shown, compute a suggested color that is different from existing ones.
    useEffect(() => {
        if (showAddLabelForm && project) {
            const usedColors = project.label_classes
                .filter(label => typeof label === 'object' && label.color)
                .map(label => label.color);
            const suggested = getSuggestedColor(usedColors);
            setSuggestedColor(suggested);
        }
    }, [showAddLabelForm, project]);

    // Add this useEffect to fetch team members
    useEffect(() => {
        if (project && userRole === 'project_owner') {
            const fetchTeamMembers = async () => {
                try {
                    const res = await fetch(`http://localhost:4000/api/project-members/${project.project_id}`);
                    if (res.ok) {
                        const members = await res.json();

                        setDataProviders(members.filter(member => member.role_type === 'data_provider'));
                        setCollaborators(members.filter(member => member.role_type === 'collaborator'));
                    } else {
                        console.error('Failed to fetch project members');
                    }
                } catch (error) {
                    console.error('Error fetching project members:', error);
                }
            };

            fetchTeamMembers();
        }
    }, [project, userRole]);

    // Add this useEffect for fetching user data folders
    useEffect(() => {
        if (project && userSession) {
            const fetchUserDataFolders = async () => {
                try {
                    // For all roles, always pass the user ID to get only their uploaded data
                    const url = `http://localhost:4000/api/project-user-data/${project.project_id}?userId=${userSession.id}`;

                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        setUserDataFolders(data);
                    }
                } catch (error) {
                    console.error('Error fetching user data folders:', error);
                }
            };

            fetchUserDataFolders();
        }
    }, [project, userSession]);

    // Add this useEffect to fetch users
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/users');
                if (res.ok) {
                    const users = await res.json();
                    setAvailableUsers(users);
                } else {
                    console.error('Failed to fetch users');
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        fetchUsers();
    }, []);

    // Handle adding a new label.
    const handleAddLabel = async () => {
        if (!newLabelName.trim()) return;

        // Only project owners can add labels
        if (userRole !== 'project_owner') {
            alert('Only project owners can add labels');
            return;
        }

        const newLabel = { name: newLabelName.trim(), color: suggestedColor };
        const updatedLabels = [...(project.label_classes || []), newLabel];
        try {
            const res = await fetch(`http://localhost:4000/api/projects/${project.project_id}/labels`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ labelClasses: updatedLabels })
            });
            if (res.ok) {
                setProject({ ...project, label_classes: updatedLabels });
                setShowAddLabelForm(false);
                setNewLabelName('');
            } else {
                console.error('Failed to update labels');
            }
        } catch (error) {
            console.error('Error updating labels:', error);
        }
    };

    // Redirect to new task creation
    const handleCreateTask = () => {
        // Only project owners can create tasks
        if (userRole !== 'project_owner') {
            alert('Only project owners can create tasks');
            return;
        }
        navigate('/tasks-image-home');
    };

    // Handle file selection for data provider uploads
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        // Determine allowed file types based on project type
        let allowedExtensions = [];
        if (project.project_type.toLowerCase().includes('image')) {
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        } else if (project.project_type.toLowerCase().includes('video')) {
            allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
        } else if (project.project_type.toLowerCase().includes('text')) {
            allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
        } else if (project.project_type.toLowerCase().includes('3d')) {
            allowedExtensions = ['.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
        }

        // Filter files based on allowed extensions
        const validFiles = selectedFiles.filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return allowedExtensions.includes(extension);
        });

        if (validFiles.length !== selectedFiles.length) {
            alert(`Only ${project.project_type.toLowerCase()} files are allowed (${allowedExtensions.join(', ')})`);
            if (validFiles.length === 0) return;
        }

        setFiles(validFiles);
    };

    // Handle file upload for data providers
    const handleUploadFiles = async () => {
        if (files.length === 0) {
            alert('Please select files to upload');
            return;
        }

        try {
            setIsUploading(true);

            const parts = project.folder_path.split('/');
            const folderId = parts[1];

            const formData = new FormData();

            // Add userId to form data for server to determine the subfolder name
            const userSession = JSON.parse(localStorage.getItem('user'));
            formData.append('userId', userSession.id);

            // Check if files are from folder upload
            const hasFolderStructure = files.some(file => file.webkitRelativePath);

            if (hasFolderStructure) {
                // For folder uploads, include the relative paths
                files.forEach(file => {
                    formData.append('filePaths', file.webkitRelativePath);
                    formData.append('files', file);
                });
            } else {
                // For regular file uploads
                files.forEach(file => {
                    formData.append('files', file);
                });
            }

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `http://localhost:4000/api/images/${folderId}`);

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentage = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percentage);
                }
            });

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    // Update project has_data status if this is the first upload
                    if (!project.hasData) {
                        await fetch(`http://localhost:4000/api/projects/${project.project_id}/update-data-status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ hasData: true })
                        });

                        // Update local state
                        setProject({ ...project, hasData: true });

                        // Send notification to project owner and collaborators
                        await fetch(`http://localhost:4000/api/notifications/data-upload`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                projectId: project.project_id,
                                uploader: userSession.username,
                                projectName: project.project_name
                            })
                        });
                    }

                    // Refresh folder tree
                    const res = await fetch(`http://localhost:4000/api/folder-structure/${folderId}`);
                    if (res.ok) {
                        const treeData = await res.json();
                        setFolderTree(treeData);
                    }

                    setShowUploadModal(false);
                    setFiles([]);
                    setUploadProgress(0);
                    alert('Files uploaded successfully');
                } else {
                    alert('Upload failed');
                }
                setIsUploading(false);
            };

            xhr.onerror = () => {
                alert('Upload failed');
                setIsUploading(false);
            };

            xhr.send(formData);

        } catch (error) {
            console.error('Error uploading files:', error);
            alert('Upload error: ' + error.message);
            setIsUploading(false);
        }
    };

    const handleFolderUpload = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        // Determine allowed file types based on project type
        let allowedExtensions = [];
        if (project.project_type.toLowerCase().includes('image')) {
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        } else if (project.project_type.toLowerCase().includes('video')) {
            allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
        } else if (project.project_type.toLowerCase().includes('text')) {
            allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
        } else if (project.project_type.toLowerCase().includes('3d')) {
            allowedExtensions = ['.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
        }

        // Filter files based on allowed extensions
        const validFiles = selectedFiles.filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return allowedExtensions.includes(extension);
        });

        if (validFiles.length !== selectedFiles.length) {
            alert(`Only ${project.project_type.toLowerCase()} files are allowed (${allowedExtensions.join(', ')})`);
            if (validFiles.length === 0) return;
        }

        setFiles(validFiles);
    };

    // Add this function to refresh data after toggle/delete
    const handleDataControlUpdate = async () => {
        if (project && userSession) {
            try {
                // Always include userId to only fetch the current user's folders
                const url = `http://localhost:4000/api/project-user-data/${project.project_id}?userId=${userSession.id}`;
                const res = await fetch(url);

                if (res.ok) {
                    const data = await res.json();
                    setUserDataFolders(data);
                }

                // Also refresh the folder tree
                const parts = project.folder_path.split('/');
                const folderId = parts[1];
                const treeRes = await fetch(`http://localhost:4000/api/folder-structure/${folderId}`);
                if (treeRes.ok) {
                    const treeData = await treeRes.json();
                    setFolderTree(treeData);
                }
            } catch (error) {
                console.error('Error refreshing data:', error);
            }
        }
    };

    // Function to validate email
    const validateEmail = (email, role) => {
        if (!email) return '';

        // Only validate format if it's a complete email (has @ and .)
        const isCompleteEmail = email.includes('@') && email.includes('.') && email.indexOf('@') < email.lastIndexOf('.');

        if (isCompleteEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return 'Invalid email format';
            }

            // Check if user exists
            const userExists = availableUsers.some(user => user.email === email);
            if (!userExists) {
                return 'User not found';
            }
        } else if (email.length > 0 && !showSuggestions) {
            // Don't show validation errors while typing or when suggestions are shown
            return '';
        }

        // Check if user is the project owner
        if (userSession && userSession.email === email) {
            return 'Cannot assign yourself (you are the owner)';
        }

        // Check if user already has a role in this project
        const isExistingDataProvider = dataProviders.some(member => member.email === email);
        const isExistingCollaborator = collaborators.some(member => member.email === email);
        const isNewDataProvider = newDataProviders.includes(email);
        const isNewCollaborator = newCollaborators.includes(email);

        if (role === 'dataProvider' && (isExistingDataProvider || isNewDataProvider)) {
            return 'User already assigned as data provider';
        } else if (role === 'collaborator' && (isExistingCollaborator || isNewCollaborator)) {
            return 'User already assigned as collaborator';
        }

        // Check if user is assigned to the other role
        if (role === 'dataProvider' && (isExistingCollaborator || isNewCollaborator)) {
            return 'User already assigned as collaborator';
        } else if (role === 'collaborator' && (isExistingDataProvider || isNewDataProvider)) {
            return 'User already assigned as data provider';
        }

        return '';
    };

    // Handle data provider input change
    const handleDataProviderChange = (e) => {
        const email = e.target.value;
        setCurrentDataProviderEmail(email);

        if (email.length > 0) {
            const filteredSuggestions = availableUsers
                .filter(user => user.email.toLowerCase().startsWith(email.toLowerCase()))
                .map(user => user.email);
            setEmailSuggestions(filteredSuggestions);
            setShowSuggestions(true);
            setSuggestionType('dataProvider');
        } else {
            setShowSuggestions(false);
        }

        setValidationErrors({
            ...validationErrors,
            dataProvider: validateEmail(email, 'dataProvider')
        });
    };

    // Handle collaborator input change
    const handleCollaboratorChange = (e) => {
        const email = e.target.value;
        setCurrentCollaboratorEmail(email);

        if (email.length > 0) {
            const filteredSuggestions = availableUsers
                .filter(user => user.email.toLowerCase().startsWith(email.toLowerCase()))
                .map(user => user.email);
            setEmailSuggestions(filteredSuggestions);
            setShowSuggestions(true);
            setSuggestionType('collaborator');
        } else {
            setShowSuggestions(false);
        }

        setValidationErrors({
            ...validationErrors,
            collaborator: validateEmail(email, 'collaborator')
        });
    };

    // Handle email suggestion selection
    const handleSelectEmail = (email) => {
        if (suggestionType === 'dataProvider') {
            setCurrentDataProviderEmail(email);
            setValidationErrors({
                ...validationErrors,
                dataProvider: validateEmail(email, 'dataProvider')
            });
        } else {
            setCurrentCollaboratorEmail(email);
            setValidationErrors({
                ...validationErrors,
                collaborator: validateEmail(email, 'collaborator')
            });
        }
        setShowSuggestions(false);
    };

    // Add a data provider to the list
    const handleAddDataProvider = () => {
        const error = validateEmail(currentDataProviderEmail, 'dataProvider');
        if (error) {
            setValidationErrors({
                ...validationErrors,
                dataProvider: error
            });
            return;
        }

        if (currentDataProviderEmail && !newDataProviders.includes(currentDataProviderEmail)) {
            setNewDataProviders([...newDataProviders, currentDataProviderEmail]);
            setCurrentDataProviderEmail('');
            setValidationErrors({
                ...validationErrors,
                dataProvider: ''
            });
        }
    };

    // Add a collaborator to the list
    const handleAddCollaborator = () => {
        const error = validateEmail(currentCollaboratorEmail, 'collaborator');
        if (error) {
            setValidationErrors({
                ...validationErrors,
                collaborator: error
            });
            return;
        }

        if (currentCollaboratorEmail && !newCollaborators.includes(currentCollaboratorEmail)) {
            setNewCollaborators([...newCollaborators, currentCollaboratorEmail]);
            setCurrentCollaboratorEmail('');
            setValidationErrors({
                ...validationErrors,
                collaborator: ''
            });
        }
    };

    // Remove a data provider from the list
    const handleRemoveNewDataProvider = (email) => {
        setNewDataProviders(newDataProviders.filter(dp => dp !== email));
    };

    // Remove a collaborator from the list
    const handleRemoveNewCollaborator = (email) => {
        setNewCollaborators(newCollaborators.filter(c => c !== email));
    };

    // Save team members to the project
    const handleSaveTeamMembers = async () => {
        if (!project) return;

        try {
            // If current fields have valid data, add them to lists
            if (currentDataProviderEmail && !validationErrors.dataProvider) {
                handleAddDataProvider();
            }

            if (currentCollaboratorEmail && !validationErrors.collaborator) {
                handleAddCollaborator();
            }

            // Only proceed if we have new members to add
            if (newDataProviders.length === 0 && newCollaborators.length === 0) {
                alert('No new team members to add');
                return;
            }

            const res = await fetch('http://localhost:4000/api/project-members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: project.project_id,
                    projectName: project.project_name,
                    ownerId: userSession.id,
                    dataProviderEmails: newDataProviders,
                    collaboratorEmails: newCollaborators
                })
            });

            if (res.ok) {
                // Reset the form
                setNewDataProviders([]);
                setNewCollaborators([]);
                setShowAddMemberModal(false);

                // Refresh the team members list
                const membersRes = await fetch(`http://localhost:4000/api/project-members/${project.project_id}`);
                if (membersRes.ok) {
                    const members = await membersRes.json();
                    setDataProviders(members.filter(member => member.role_type === 'data_provider'));
                    setCollaborators(members.filter(member => member.role_type === 'collaborator'));
                }

                alert('Team members added successfully');
            } else {
                const error = await res.json();
                throw new Error(error.message || 'Failed to add team members');
            }
        } catch (error) {
            console.error('Error adding team members:', error);
            alert('Error adding team members: ' + error.message);
        }
    };


    if (loading) {
        return (
            <div className="project-info-page">
                <UserHomeTopBar />
                <div className="project-info-container">
                    <div className="loading-spinner">Loading...</div>
                </div>
            </div>
        );
    }

    if (unauthorized) {
        return (
            <div className="project-info-page">
                <UserHomeTopBar />
                <div className="project-info-container">
                    <div className="error-message">
                        <h2>Access Denied</h2>
                        <p>You don't have permission to access this project.</p>
                        <button onClick={() => navigate('/projects')} className="back-btn">
                            Back to Projects
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="project-info-page">
                <UserHomeTopBar />
                <div className="project-info-container">
                    <div className="error-message">Project not found.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="project-info-page">
            <UserHomeTopBar />
            <div className="project-info-container">
                <div className="project-info-header">
                    <h2>Project Information</h2>
                    <div className="role-indicator">
                        <span className={`role-badge ${userRole === 'project_owner'
                            ? 'owner-badge'
                            : userRole === 'data_provider'
                                ? 'provider-badge'
                                : 'collaborator-badge'}`}>
                            {userRole === 'project_owner'
                                ? 'Owner'
                                : userRole === 'data_provider'
                                    ? 'Data Provider'
                                    : 'Collaborator'}
                        </span>
                    </div>
                </div>

                {/* Project Info Card */}
                <div className="project-info-card">
                    <div className="info-item">
                        <div className="info-icon">
                            <FiEdit />
                        </div>
                        <span className="info-label">Project Name:</span>
                        <span className="info-value">{project.project_name}</span>
                    </div>

                    <div className="info-item">
                        <div className="info-icon">
                            <FiGrid />
                        </div>
                        <span className="info-label">Project Type:</span>
                        <span className="info-value">{project.project_type}</span>
                    </div>

                    {project.created_at && (
                        <div className="info-item">
                            <div className="info-icon">
                                <FiCalendar />
                            </div>
                            <span className="info-label">Created:</span>
                            <span className="info-value">
                                {new Date(project.created_at.trim()).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    )}

                    {project.team_members && (
                        <div className="info-item">
                            <div className="info-icon">
                                <FiUsers />
                            </div>
                            <span className="info-label">Team:</span>
                            <span className="info-value">
                                {project.team_members.join(', ') || 'No team members'}
                            </span>
                        </div>
                    )}
                </div>

                {userRole === 'project_owner' && (
                    <div className="team-section">
                        <div className="section-header-with-actions">
                            <h3><FiUsers /> Project Team</h3>
                            {userRole === 'project_owner' && (
                                <button
                                    className="add-team-member-btn"
                                    onClick={() => setShowAddMemberModal(true)}
                                >
                                    <FiUserPlus /> Add Team Members
                                </button>
                            )}
                        </div>
                        <div className="team-container">
                            <div className="team-column">
                                <h4 className="team-role-title">Data Providers</h4>
                                {dataProviders.length > 0 ? (
                                    <ul className="team-members-list">
                                        {dataProviders.map((member, index) => (
                                            <li key={index} className="team-member">
                                                <div className="team-member-avatar">
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="team-member-info">
                                                    <span className="team-member-name">{member.username}</span>
                                                    <span className="team-member-email">{member.email}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="no-members-message">No data providers assigned</p>
                                )}
                            </div>

                            <div className="team-column">
                                <h4 className="team-role-title">Collaborators</h4>
                                {collaborators.length > 0 ? (
                                    <ul className="team-members-list">
                                        {collaborators.map((member, index) => (
                                            <li key={index} className="team-member">
                                                <div className="team-member-avatar">
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="team-member-info">
                                                    <span className="team-member-name">{member.username}</span>
                                                    <span className="team-member-email">{member.email}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="no-members-message">No collaborators assigned</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Add this modal for managing team members */}
                {showAddMemberModal && (
                    <div className="modal-overlay">
                        <div className="modal-box team-modal">
                            <h3>Add Team Members to Project</h3>
                            <p>Add data providers and collaborators to: {project.project_name}</p>

                            {/* Data Provider Section */}
                            <div className="team-modal-section">
                                <h4><FiUserPlus /> Data Providers (will upload data)</h4>

                                {/* Selected Data Providers List */}
                                {newDataProviders.length > 0 && (
                                    <div className="selected-members-list">
                                        {newDataProviders.map((email, index) => (
                                            <div key={index} className="member-chip">
                                                <span>{email}</span>
                                                <button
                                                    className="remove-btn"
                                                    onClick={() => handleRemoveNewDataProvider(email)}
                                                >
                                                    <FiX />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Data Provider Form */}
                                <div className="add-member-form">
                                    <input
                                        type="email"
                                        value={currentDataProviderEmail}
                                        onChange={handleDataProviderChange}
                                        placeholder="Enter email address"
                                        className={validationErrors.dataProvider ? 'error' : ''}
                                    />
                                    <button
                                        className="add-btn"
                                        onClick={handleAddDataProvider}
                                        disabled={!currentDataProviderEmail || validationErrors.dataProvider}
                                    >
                                        <FiPlusCircle /> Add
                                    </button>
                                </div>

                                {validationErrors.dataProvider && (
                                    <span className="error-message">{validationErrors.dataProvider}</span>
                                )}

                                {showSuggestions && suggestionType === 'dataProvider' && emailSuggestions.length > 0 && (
                                    <div className="email-suggestions">
                                        {emailSuggestions.map((email, index) => (
                                            <div
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => handleSelectEmail(email)}
                                            >
                                                {email}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Collaborator Section */}
                            <div className="team-modal-section">
                                <h4><FiUserPlus /> Collaborators (will annotate data)</h4>

                                {/* Selected Collaborators List */}
                                {newCollaborators.length > 0 && (
                                    <div className="selected-members-list">
                                        {newCollaborators.map((email, index) => (
                                            <div key={index} className="member-chip">
                                                <span>{email}</span>
                                                <button
                                                    className="remove-btn"
                                                    onClick={() => handleRemoveNewCollaborator(email)}
                                                >
                                                    <FiX />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Collaborator Form */}
                                <div className="add-member-form">
                                    <input
                                        type="email"
                                        value={currentCollaboratorEmail}
                                        onChange={handleCollaboratorChange}
                                        placeholder="Enter email address"
                                        className={validationErrors.collaborator ? 'error' : ''}
                                    />
                                    <button
                                        className="add-btn"
                                        onClick={handleAddCollaborator}
                                        disabled={!currentCollaboratorEmail || validationErrors.collaborator}
                                    >
                                        <FiPlusCircle /> Add
                                    </button>
                                </div>

                                {validationErrors.collaborator && (
                                    <span className="error-message">{validationErrors.collaborator}</span>
                                )}

                                {showSuggestions && suggestionType === 'collaborator' && emailSuggestions.length > 0 && (
                                    <div className="email-suggestions">
                                        {emailSuggestions.map((email, index) => (
                                            <div
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => handleSelectEmail(email)}
                                            >
                                                {email}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div className="modal-buttons">
                                <button
                                    className="btn"
                                    onClick={handleSaveTeamMembers}
                                    disabled={newDataProviders.length === 0 && newCollaborators.length === 0}
                                >
                                    Add Team Members
                                </button>
                                <button
                                    className="btn cancel-btn"
                                    onClick={() => {
                                        setShowAddMemberModal(false);
                                        setNewDataProviders([]);
                                        setNewCollaborators([]);
                                        setCurrentDataProviderEmail('');
                                        setCurrentCollaboratorEmail('');
                                        setValidationErrors({ dataProvider: '', collaborator: '' });
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Status Indicator */}
                {!project.hasData && (
                    <div className="data-status-warning">
                        <FiInfo /> This project has no data yet.
                        {userRole === 'data_provider' && (
                            <button
                                className="upload-data-btn"
                                onClick={() => setShowUploadModal(true)}
                            >
                                <FiUpload /> Upload Data
                            </button>
                        )}
                    </div>
                )}

                {/* Labels Section */}
                <div className="labels-section">
                    <div className="labels-header">
                        <h3><FiTag /> Labels</h3>
                        {userRole === 'project_owner' && (
                            <button className="add-label-btn" onClick={() => setShowAddLabelForm(true)}>
                                <FiPlusCircle /> Add Label
                            </button>
                        )}
                    </div>

                    <div className="labels-grid">
                        {project.label_classes.map((label, index) => {
                            const labelObj = typeof label === 'object' ? label : { name: label, color: candidateColors[index % candidateColors.length] };
                            return (
                                <div
                                    key={index}
                                    className="label-chip"
                                    style={{
                                        backgroundColor: `${labelObj.color}20`, // 20% opacity
                                        color: labelObj.color
                                    }}
                                >
                                    <div
                                        className="label-color"
                                        style={{ backgroundColor: labelObj.color }}
                                    ></div>
                                    {labelObj.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Folder Structure Section */}
                <div className="folder-structure-section">
                    <div className="folder-structure-header">
                        <h3><FiFolder /> Folder Structure</h3>
                        {userRole === 'data_provider' && (
                            <button
                                className="upload-files-btn"
                                onClick={() => setShowUploadModal(true)}
                            >
                                <FiUploadCloud /> Upload Data
                            </button>
                        )}
                    </div>

                    {folderTree ? (
                        <div className="folder-tree">
                            <ul>
                                <EnhancedFolderTree node={folderTree} />
                            </ul>
                        </div>
                    ) : (
                        <p>No folder structure available.</p>
                    )}
                </div>

                {userDataFolders.length > 0 && (
                    <div className="data-controls-section">
                        <div className="data-controls-header">
                            <h3><FiDatabase /> My Uploaded Data</h3>
                        </div>

                        <div className="data-controls-description">
                            <p>Manage your uploaded data. You can temporarily disable access to your data or delete it permanently.</p>
                        </div>

                        <div className="user-data-folders-list">
                            {userDataFolders.map((folder, index) => (
                                <UserDataControls
                                    key={index}
                                    projectId={project.project_id}
                                    userFolder={folder.folderName}
                                    username={folder.username}
                                    onUpdate={handleDataControlUpdate}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions Section */}
                {userRole === 'project_owner' && (
                    <div className="actions-section">
                        <button
                            className="btn create-task-btn"
                            onClick={handleCreateTask}
                            disabled={!project.hasData}
                        >
                            <FiCheckSquare /> Create New Task
                        </button>
                        {!project.hasData && (
                            <p className="no-data-warning">
                                <FiInfo /> Cannot create tasks until data is uploaded
                            </p>
                        )}
                    </div>
                )}

                {/* Add Label Modal */}
                {showAddLabelForm && (
                    <div className="modal-overlay">
                        <div className="modal-box">
                            <h3>Add New Label</h3>
                            <input
                                type="text"
                                placeholder="Enter label name"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                            />
                            <div className="color-picker-container">
                                <label>Label Color:</label>
                                <input
                                    type="color"
                                    value={suggestedColor}
                                    onChange={(e) => setSuggestedColor(e.target.value)}
                                    className="color-input"
                                />
                            </div>
                            <div className="modal-buttons">
                                <button className="btn" onClick={handleAddLabel}>Add Label</button>
                                <button className="btn cancel-btn" onClick={() => setShowAddLabelForm(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Files Modal */}
                {showUploadModal && (
                    <div className="modal-overlay">
                        <div className="modal-box upload-modal">
                            <h3>Upload Data to Project</h3>
                            <p>Add files or folders to: {project.project_name}</p>

                            <div className="upload-section">
                                <label>Select Files or Folder</label>
                                <div className="upload-controls">
                                    <label htmlFor="project-file-input" className="upload-files-button">
                                        <FiFile /> Upload Files
                                    </label>
                                    <span className="divider"></span>
                                    <label htmlFor="project-folder-input" className="upload-folders-button">
                                        <FiFolder /> Upload Folders
                                    </label>
                                    <input
                                        id="project-file-input"
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                    />
                                    <input
                                        id="project-folder-input"
                                        type="file"
                                        webkitdirectory="true"
                                        directory="true"
                                        onChange={handleFolderUpload}
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                    />
                                </div>

                                {files.length > 0 && (
                                    <div className="selected-files-info">
                                        <p>{files.length} files selected</p>
                                        <ul className="selected-files-list">
                                            {files.slice(0, 5).map((file, index) => (
                                                <li key={index}>{file.name}</li>
                                            ))}
                                            {files.length > 5 && <li>...and {files.length - 5} more</li>}
                                        </ul>
                                    </div>
                                )}

                                {isUploading && (
                                    <div className="upload-progress">
                                        <div
                                            className="progress-bar"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                        <span className="progress-text">{uploadProgress}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="modal-buttons">
                                <button
                                    className="btn"
                                    onClick={handleUploadFiles}
                                    disabled={isUploading || files.length === 0}
                                >
                                    {isUploading ? 'Uploading...' : 'Upload Files'}
                                </button>
                                <button
                                    className="btn cancel-btn"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setFiles([]);
                                        setUploadProgress(0);
                                    }}
                                    disabled={isUploading}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}