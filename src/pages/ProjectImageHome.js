// src/pages/ProjectImageHome.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './ProjectImageHome.css';
import {
  FiFolder,
  FiFile,
  FiTag,
  FiPlusCircle,
  FiUpload,
  FiCheckSquare,
  FiX,
  FiImage,
  FiVideo,
  FiFileText,
  FiBox,
  FiUsers,
  FiUserPlus
} from 'react-icons/fi';

const COLOR_PALETTE = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
];

export default function ProjectImageHome() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode detections
  const segmentationMode = location.state?.segmentationMode || false;
  const classificationMode = location.state?.classificationMode || false;
  const threeDMode = location.state?.threeDMode || false;
  const projectMode = location.state?.projectMode || false;

  // States for task mode
  const [taskName, setTaskName] = useState('');
  // States for project mode
  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('Image Annotation');
  const [projectType, setProjectType] = useState('image detection');
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(COLOR_PALETTE[0]);
  const [colorIndex, setColorIndex] = useState(1);
  const [labelClasses, setLabelClasses] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [folderData, setFolderData] = useState(null);
  const [isCreating, setIsCreating] = useState(false); // Loading state for Create Project

  // New states for collaborators
  const [dataProviderEmail, setDataProviderEmail] = useState('');
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [validationErrors, setValidationErrors] = useState({
    dataProvider: '',
    collaborator: ''
  });
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionType, setSuggestionType] = useState(null); // 'dataProvider' or 'collaborator'



  const allowedAccept = projectMode
    ? projectCategory === 'Image Annotation'
      ? 'image/*'
      : projectCategory === 'Video Annotation'
        ? 'video/*'
        : projectCategory === 'Text Annotation'
          ? '.txt,.doc,.docx,.pdf'
          : ''
    : threeDMode
      ? ''
      : 'image/*';

  const allowedFileTypesHint = projectMode
    ? projectCategory === 'Image Annotation'
      ? 'Allowed file types: Images (e.g. .jpg, .jpeg, .png, .gif, .bmp, .webp)'
      : projectCategory === 'Video Annotation'
        ? 'Allowed file types: Videos (e.g. .mp4, .avi, .mov, .mkv, .webm)'
        : projectCategory === 'Text Annotation'
          ? 'Allowed file types: Text/Documents (e.g. .txt, .doc, .docx, .pdf)'
          : ''
    : '';

  useEffect(() => {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
      localStorage.setItem(
        'redirectAfterLogin',
        JSON.stringify({ path: '/images', state: location.state })
      );
      navigate('/signin');
      return;
    }
    const limited = files.slice(0, 5).map(f => ({
      url: URL.createObjectURL(f),
      name: f.name
    }));
    setPreviews(limited);
    return () => limited.forEach(p => URL.revokeObjectURL(p.url));
  }, [files, navigate, location.state]);

  // Fetch available users to validate emails
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/users');
        if (res.ok) {
          const users = await res.json();
          setAvailableUsers(users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (projectMode) {
      let allowedExtensions = [];
      if (projectCategory === 'Image Annotation') {
        allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      } else if (projectCategory === 'Video Annotation') {
        allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
      } else if (projectCategory === 'Text Annotation') {
        allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
      }
      const validFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
      });
      if (validFiles.length !== selectedFiles.length) {
        alert(`Only ${projectCategory.toLowerCase()} files are allowed (${allowedExtensions.join(', ')})`);
        if (validFiles.length === 0) return;
      }
      setFiles(validFiles);
    } else if (threeDMode) {
      const allowed3DFormats = ['.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
      const valid3DFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowed3DFormats.includes(extension);
      });
      if (valid3DFiles.length !== selectedFiles.length) {
        alert('Only 3D model files are allowed (.obj, .glb, .gltf, .ply, .stl, .3ds, .fbx)');
        if (valid3DFiles.length === 0) return;
      }
      setFiles(valid3DFiles);
    } else {
      setFiles(selectedFiles);
    }
  };

  const handleFolderUpload = async (e) => {
    let selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    if (projectMode) {
      let allowedExtensions = [];
      if (projectCategory === 'Image Annotation') {
        allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      } else if (projectCategory === 'Video Annotation') {
        allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
      } else if (projectCategory === 'Text Annotation') {
        allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
      }
      const validFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
      });
      if (validFiles.length !== selectedFiles.length) {
        alert(`Only ${projectCategory.toLowerCase()} files are allowed (${allowedExtensions.join(', ')})`);
        if (validFiles.length === 0) return;
      }
      selectedFiles = validFiles;
    }

    const rootFolderName = selectedFiles[0].webkitRelativePath.split('/')[0];
    const rootLevelFiles = selectedFiles.filter(file => {
      const pathParts = file.webkitRelativePath.split('/');
      return pathParts.length === 2;
    });

    const limited = rootLevelFiles.slice(0, 5).map(f => ({
      url: URL.createObjectURL(f),
      name: f.webkitRelativePath
    }));
    setPreviews(limited);
    setFiles(selectedFiles);
  };

  const getNextColor = () => {
    const col = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    setColorIndex(colorIndex + 1);
    return col;
  };

  const handleAddLabel = async () => {
    if (!labelName.trim()) {
      alert('Label name is empty');
      return;
    }
    const nameExists = labelClasses.some(lc => lc.name.toLowerCase() === labelName.trim().toLowerCase());
    if (nameExists) {
      alert('Label already exists');
      return;
    }
    const colorExists = labelClasses.some(lc => lc.color.toLowerCase() === labelColor.trim().toLowerCase());
    if (colorExists) {
      alert('Label color already used. Please choose a different color.');
      return;
    }
    const newLabel = { name: labelName.trim(), color: labelColor };
    const updatedLabels = [...labelClasses, newLabel];
    if (folderData?.taskId) {
      try {
        const updateLabelsRes = await fetch(`http://localhost:4000/api/tasks/${folderData.taskId}/labels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelClasses: updatedLabels })
        });
        if (!updateLabelsRes.ok) throw new Error('Failed to update labels in task');
        const annotationsRes = await fetch('http://localhost:4000/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folderData.folderId,
            taskName: taskName,
            labelClasses: updatedLabels,
            annotations: {}
          })
        });
        if (!annotationsRes.ok) throw new Error('Failed to update annotations');
      } catch (error) {
        console.error('Error updating labels:', error);
        alert('Failed to update labels: ' + error.message);
        return;
      }
    }
    setLabelClasses(updatedLabels);
    setLabelName('');
    setLabelColor(getNextColor());
  };

  const handleRemoveLabel = async (i) => {
    const updatedLabels = labelClasses.filter((_, idx) => idx !== i);
    if (folderData?.taskId) {
      try {
        const updateLabelsRes = await fetch(`http://localhost:4000/api/tasks/${folderData.taskId}/labels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelClasses: updatedLabels })
        });
        if (!updateLabelsRes.ok) throw new Error('Failed to update labels in task');
        const annotationsRes = await fetch('http://localhost:4000/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folderData.folderId,
            taskName: taskName,
            labelClasses: updatedLabels,
            annotations: {}
          })
        });
        if (!annotationsRes.ok) throw new Error('Failed to update annotations');
      } catch (error) {
        console.error('Error updating labels:', error);
        alert('Failed to update labels: ' + error.message);
        return;
      }
    }
    setLabelClasses(updatedLabels);
  };

  const validateEmail = (email, role) => {
    if (!email) return '';

    // Only validate format if it's a complete email (has @ and .)
    // This prevents "invalid email format" during typing
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
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser && currentUser.email === email) {
      return 'Cannot assign yourself';
    }

    // Check if same user is assigned to both roles
    if (role === 'dataProvider' && email === collaboratorEmail) {
      return 'User already assigned as collaborator';
    } else if (role === 'collaborator' && email === dataProviderEmail) {
      return 'User already assigned as data provider';
    }

    return '';
  };

  const handleDataProviderChange = (e) => {
    const email = e.target.value;
    setDataProviderEmail(email);

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

  const handleCollaboratorChange = (e) => {
    const email = e.target.value;
    setCollaboratorEmail(email);

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

  // Add new function to handle suggestion selection
  const handleSelectEmail = (email) => {
    if (suggestionType === 'dataProvider') {
      setDataProviderEmail(email);
      setValidationErrors({
        ...validationErrors,
        dataProvider: validateEmail(email, 'dataProvider')
      });
    } else {
      setCollaboratorEmail(email);
      setValidationErrors({
        ...validationErrors,
        collaborator: validateEmail(email, 'collaborator')
      });
    }
    setShowSuggestions(false);
  };

  const handleUpload = async () => {
    if (!taskName.trim()) {
      alert('Enter a task name');
      return;
    }
    if (!files.length) {
      alert('Select images first');
      return;
    }
    if (!labelClasses.length) {
      alert('Add at least one label class');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('taskName', taskName);
      formData.append('labelClasses', JSON.stringify(labelClasses));
      files.forEach(f => formData.append('files', f));
      const uploadRes = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const userSession = JSON.parse(localStorage.getItem('user'));
      const taskType = segmentationMode
        ? 'segmentation'
        : classificationMode
          ? 'classification'
          : threeDMode
            ? '3dannotation'
            : 'detection';
      const taskRes = await fetch('http://localhost:4000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userSession.id,
          taskName: taskName,
          folderId: uploadData.folderId,
          taskType: taskType,
          labelClasses: labelClasses
        })
      });
      if (!taskRes.ok) throw new Error('Failed to create task');
      const taskData = await taskRes.json();
      setFolderData({ ...uploadData, taskId: taskData.taskId });
      alert('Upload success!');
    } catch (err) {
      console.error('Error:', err);
      alert('Upload error: ' + err.message);
    }
  };

  const goAnnotate = () => {
    if (!folderData) return;
    if (segmentationMode) {
      navigate('/segmentation', { state: { folderInfo: folderData } });
    } else if (classificationMode) {
      navigate('/classification', { state: { folderInfo: folderData } });
    } else if (threeDMode) {
      navigate('/3d', { state: { folderInfo: folderData } });
    } else {
      navigate('/detection', { state: { folderInfo: folderData } });
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      alert('Enter a project name');
      return;
    }

    // Validate collaborator emails if provided
    if (dataProviderEmail && validationErrors.dataProvider) {
      alert(`Data provider error: ${validationErrors.dataProvider}`);
      return;
    }

    if (collaboratorEmail && validationErrors.collaborator) {
      alert(`Collaborator error: ${validationErrors.collaborator}`);
      return;
    }

    // If no data provider is assigned, files are mandatory
    if (!dataProviderEmail && files.length === 0) {
      alert('Please upload files or assign a data provider');
      return;
    }

    try {
      setIsCreating(true); // Start loading state
      const projectsRes = await fetch('http://localhost:4000/api/projects');
      if (projectsRes.ok) {
        const existingProjects = await projectsRes.json();
        const duplicate = existingProjects.some(
          (proj) => proj.project_name.toLowerCase() === projectName.trim().toLowerCase()
        );
        if (duplicate) {
          alert('A project with this name already exists. Please choose a different name.');
          setIsCreating(false);
          return;
        }
      }
    } catch (err) {
      console.error('Error checking for duplicates:', err);
    }

    if (!labelClasses.length) {
      alert('Add at least one label class');
      setIsCreating(false);
      return;
    }

    try {
      let uploadData = { folderId: null };
      const userSession = JSON.parse(localStorage.getItem('user'));

      // Only upload files if there are any
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('projectName', projectName);
        formData.append('labelClasses', JSON.stringify(labelClasses));
        // Add user ID to the form data so the server knows which user is uploading
        formData.append('userId', userSession.id);

        files.forEach(file => {
          formData.append('filePaths', file.webkitRelativePath || file.name);
          formData.append('files', file);
        });

        const uploadRes = await fetch('http://localhost:4000/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Upload failed');
        uploadData = await uploadRes.json();
      } else {
        // If no files, create an empty folder for the project
        const createFolderRes = await fetch('http://localhost:4000/api/create-empty-folder', {
          method: 'POST'
        });

        if (!createFolderRes.ok) throw new Error('Failed to create project folder');
        uploadData = await createFolderRes.json();
      }

      const projectRes = await fetch('http://localhost:4000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userSession.id,
          projectName: projectName,
          folderId: uploadData.folderId,
          projectType: projectType,
          labelClasses: labelClasses,
          dataProviderEmail: dataProviderEmail || null,
          collaboratorEmail: collaboratorEmail || null,
          hasData: files.length > 0
        })
      });

      if (!projectRes.ok) throw new Error('Failed to create project');
      const projectData = await projectRes.json();

      // Create role assignments
      if (dataProviderEmail || collaboratorEmail) {
        // Get user IDs for the email addresses
        const dataProvider = availableUsers.find(user => user.email === dataProviderEmail);
        const collaborator = availableUsers.find(user => user.email === collaboratorEmail);

        // Create role assignments
        const rolesRes = await fetch('http://localhost:4000/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectData.projectId,
            ownerId: userSession.id,
            dataProviderId: dataProvider ? dataProvider.id : null,
            collaboratorId: collaborator ? collaborator.id : null
          })
        });

        if (!rolesRes.ok) throw new Error('Failed to assign roles');

        // Send notifications to users
        if (dataProvider) {
          await fetch('http://localhost:4000/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: dataProvider.id,
              message: `${userSession.username} assigned you as data provider for project "${projectName}"`,
              related_project_id: projectData.projectId
            })
          });
        }

        if (collaborator) {
          await fetch('http://localhost:4000/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: collaborator.id,
              message: `${userSession.username} assigned you as collaborator for project "${projectName}"`,
              related_project_id: projectData.projectId
            })
          });
        }
      }

      setFolderData({ ...uploadData, projectId: projectData.projectId });
      alert('Project created successfully!');
      navigate('/projects');
    } catch (err) {
      console.error('Error:', err);
      alert('Project creation error: ' + err.message);
    } finally {
      setIsCreating(false); // End loading state
    }
  };

  return (
    <div className="parent-container">
      <UserHomeTopBar />
      <div className="image-home-container">
        {projectMode ? (
          <>
            <h2><FiFolder /> Create a New Project</h2>
            <div className="form-area">
              <label>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. My New Project"
              />
            </div>
            <div className="form-area">
              <label>Project Category</label>
              <div className="radio-group">
                <label title="Annotate images with labels or bounding boxes">
                  <input
                    type="radio"
                    value="Image Annotation"
                    checked={projectCategory === 'Image Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('image detection');
                    }}
                  />
                  <span><FiImage /> Image Annotation</span>
                </label>
                <label title="Annotate videos with tracking or segmentation">
                  <input
                    type="radio"
                    value="Video Annotation"
                    checked={projectCategory === 'Video Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('video detection');
                    }}
                  />
                  <span><FiVideo /> Video Annotation</span>
                </label>
                <label title="Annotate text with spans or relations">
                  <input
                    type="radio"
                    value="Text Annotation"
                    checked={projectCategory === 'Text Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('Span annotation');
                    }}
                  />
                  <span><FiFileText /> Text Annotation</span>
                </label>
              </div>
            </div>
            {projectCategory === 'Image Annotation' && (
              <div className="form-area">
                <label>Image Annotation Options</label>
                <div className="radio-group">
                  <label title="Detect objects with bounding boxes">
                    <input
                      type="radio"
                      value="image detection"
                      checked={projectType === 'image detection'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Image Detection</span>
                  </label>
                  <label title="Segment objects with precise outlines">
                    <input
                      type="radio"
                      value="image segmentation"
                      checked={projectType === 'image segmentation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Image Segmentation</span>
                  </label>
                  <label title="Classify entire images">
                    <input
                      type="radio"
                      value="image classification"
                      checked={projectType === 'image classification'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Image Classification</span>
                  </label>
                  <label title="Annotate 3D images or models">
                    <input
                      type="radio"
                      value="3d image annotation"
                      checked={projectType === '3d image annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span><FiBox /> 3D Image Annotation</span>
                  </label>
                  <label title="Add key points to estimate pose or other functionalities">
                    <input
                      type="radio"
                      value="key points annotation"
                      checked={projectType === 'key points annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span> Key Points Annotation</span>
                  </label>
                  <label title="Describe images with short descriptions">
                    <input
                      type="radio"
                      value="image captioning"
                      checked={projectType === 'image captioning'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span> Image Captioning</span>
                  </label>
                </div>
              </div>
            )}
            {projectCategory === 'Video Annotation' && (
              <div className="form-area">
                <label>Video Annotation Options</label>
                <div className="radio-group">
                  <label title="Detect objects across video frames">
                    <input
                      type="radio"
                      value="video detection"
                      checked={projectType === 'video detection'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Video Detection</span>
                  </label>
                  <label title="Segment objects in video frames">
                    <input
                      type="radio"
                      value="video segmentation"
                      checked={projectType === 'video segmentation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Video Segmentation</span>
                  </label>
                </div>
              </div>
            )}
            {projectCategory === 'Text Annotation' && (
              <div className="form-area">
                <label>Text Annotation Options</label>
                <div className="radio-group">
                  <label title="Highlight specific text spans">
                    <input
                      type="radio"
                      value="Span annotation"
                      checked={projectType === 'Span annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Span Annotation</span>
                  </label>
                  <label title="Define relationships between text spans">
                    <input
                      type="radio"
                      value="relation annotation"
                      checked={projectType === 'relation annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Relation Annotation</span>
                  </label>
                  <label title="Classify entire documents">
                    <input
                      type="radio"
                      value="document-level annotation"
                      checked={projectType === 'document-level annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    <span>Document-Level Annotation</span>
                  </label>
                </div>
              </div>
            )}

            {/* New section for inviting collaborators */}
            <div className="collaborators-section">
              <h3><FiUsers /> Invite Data Provider or Collaborator</h3>
              <div className="collaborator-form">
                <div className="form-group">
                  <label>
                    <FiUserPlus /> Data Provider (will upload data)
                  </label>
                  <input
                    type="email"
                    value={dataProviderEmail}
                    onChange={handleDataProviderChange}
                    placeholder="Enter email address"
                    className={validationErrors.dataProvider ? 'error' : ''}
                  />
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
                <div className="form-group">
                  <label>
                    <FiUserPlus /> Collaborator (will annotate data)
                  </label>
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={handleCollaboratorChange}
                    placeholder="Enter email address"
                    className={validationErrors.collaborator ? 'error' : ''}
                  />
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
              </div>
            </div>

            <div className="labels-section">
              <h3><FiTag /> Label Classes</h3>
              <div className="label-form">
                <input
                  type="text"
                  placeholder="e.g. Car"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                />
                <input
                  type="color"
                  value={labelColor}
                  onChange={(e) => setLabelColor(e.target.value)}
                />
                <button onClick={handleAddLabel}><FiPlusCircle /> Add</button>
              </div>
              <ul className="label-list">
                {labelClasses.map((lc, i) => (
                  <li key={i}>
                    <span className="color-box" style={{ background: lc.color }} />
                    {lc.name}
                    <button onClick={() => handleRemoveLabel(i)}><FiX /></button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="form-area">
              <label>Select Files or Folder</label>
              <div className="upload-controls">
                <label htmlFor="proj-file-input" className="upload-files-button">
                  <FiFile /> Upload Files
                </label>
                <span className="divider"></span>
                <label htmlFor="folder-input" className="upload-folders-button">
                  <FiFolder /> Upload Folders
                </label>
                <input
                  id="proj-file-input"
                  type="file"
                  multiple
                  accept={allowedAccept}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <input
                  id="folder-input"
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  accept={allowedAccept}
                  onChange={handleFolderUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <p className="file-hint">{allowedFileTypesHint}</p>
            </div>
            {previews.length > 0 && (
              <div className="preview-grid">
                {previews.map((p, i) => (
                  <div key={i} className="preview-item" style={{ animation: `fadeInPreview 0.5s ease ${i * 0.1}s forwards` }}>
                    <img src={p.url} alt={p.name} title={p.name} />
                  </div>
                ))}
              </div>
            )}
            <div className="buttons-row">
              <button onClick={handleCreateProject} disabled={isCreating}>
                {isCreating ? (
                  <span className="loading-spinner">Creating...</span>
                ) : (
                  <>
                    <FiCheckSquare /> Create Project
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Inline style for preview animation (could also be moved to CSS)
const fadeInPreview = `
  @keyframes fadeInPreview {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = fadeInPreview;
document.head.appendChild(styleSheet);

