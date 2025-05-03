import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Projects.css';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [filterType, setFilterType] = useState('all');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [userSession, setUserSession] = useState(null);
  const [userRoles, setUserRoles] = useState({}); // Store role for each project

  useEffect(() => {
    const userSessionData = localStorage.getItem('user');
    if (!userSessionData) {
      localStorage.setItem(
        'redirectAfterLogin',
        JSON.stringify({ path: '/projects' })
      );
      navigate('/signin');
      return;
    }
    const user = JSON.parse(userSessionData);
    setUserSession(user);

    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Get all projects this user has access to (as owner, data provider, or collaborator)
        const res = await fetch(`http://localhost:4000/api/user-projects/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects);
          setUserRoles(data.roles);
        } else {
          console.error('Failed to fetch projects');
        }

      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [navigate]);

  const handleDelete = async (projectId, e) => {
    e.stopPropagation();

    // Only project owners can delete projects
    if (userRoles[projectId] !== 'project_owner') {
      alert('Only project owners can delete projects');
      return;
    }

    if (deleteConfirmation === projectId) {
      // Second confirmation about tasks
      if (window.confirm("Deleting this project will also delete all its associated tasks. Are you sure?")) {
        try {
          const res = await fetch(`http://localhost:4000/api/projects/${projectId}?userId=${userSession.id}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            setProjects(projects.filter(project => project.project_id !== projectId));
            setDeleteConfirmation(null);
            alert('Project and all associated tasks deleted successfully');
          } else {
            const error = await res.json();
            alert(error.error || 'Failed to delete project');
            console.error('Failed to delete project:', error);
          }
        } catch (error) {
          console.error('Error deleting project:', error);
          alert('An error occurred while deleting the project.');
        }
      } else {
        // User canceled the second confirmation
        setDeleteConfirmation(null);
      }
    } else {
      setDeleteConfirmation(projectId);
    }
  };

  const cancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirmation(null);
  };

  const handleProjectClick = (project) => {
    const role = userRoles[project.project_id];

    // Collaborators can't access project info
    if (role === 'collaborator') {
      return;
    }

    navigate(`/project-info/${project.project_id}`, {
      state: { userRole: role }
    });
  };

  const sortProjects = (projectsList) => {
    switch (sortBy) {
      case 'newest':
        return [...projectsList].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
      case 'oldest':
        return [...projectsList].sort(
          (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
        );
      case 'name':
        return [...projectsList].sort((a, b) =>
          a.project_name.localeCompare(b.project_name)
        );
      case 'nameDesc':
        return [...projectsList].sort((a, b) =>
          b.project_name.localeCompare(a.project_name)
        );
      default:
        return projectsList;
    }
  };

  const filterProjects = (projectsList) => {
    if (filterType === 'all') return projectsList;
    return projectsList.filter(project => {
      const type = project.project_type?.toLowerCase() || '';
      if (filterType === 'image') return type.includes('image');
      if (filterType === 'video') return type.includes('video');
      if (filterType === 'text')
        return (
          type.includes('text') ||
          type.includes('span') ||
          type.includes('document') ||
          type.includes('relation')
        );
      if (filterType === '3d') return type.includes('3d');
      return true;
    });
  };

  const getProjectTypeIcon = (projectType) => {
    const type = projectType?.toLowerCase() || '';
    if (type.includes('image')) return "📷";
    if (type.includes('video')) return "🎬";
    if (type.includes('text') || type.includes('span') || type.includes('document') || type.includes('relation')) return "📝";
    if (type.includes('3d')) return "🧊";
    return "📂";
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date available';
    const date = new Date(dateString.trim()); // trim extra whitespace/CR
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getProjectThumbnail = (project) => {
    const type = project.project_type?.toLowerCase() || '';
    if (type.includes('text') || type.includes('span') || type.includes('document') || type.includes('relation')) {
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">
                <rect width="300" height="180" fill="%23f5f7fa" />
                <rect x="40" y="40" width="220" height="20" rx="4" fill="%23e6e6e6" />
                <rect x="40" y="70" width="180" height="20" rx="4" fill="%23e6e6e6" />
                <rect x="40" y="100" width="200" height="20" rx="4" fill="%23e6e6e6" />
                <rect x="40" y="130" width="140" height="20" rx="4" fill="%23e6e6e6" />
              </svg>`;
    }
    return project.thumbnailImage || `http://localhost:4000/${project.folder_path}/default.jpg`;
  };

  const getProjectStatusBadge = (project) => {
    // Check if project has no data
    if (!project.hasData) {
      return <span className="status-badge no-data-badge">No Data</span>;
    }

    const createdDate = new Date(project.created_at || 0);
    const now = new Date();
    const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation < 1) {
      return <span className="status-badge new-badge">New</span>;
    } else if (daysSinceCreation < 7) {
      return <span className="status-badge in-progress-badge">In Progress</span>;
    }
    return null;
  };

  const getRoleBadge = (projectId) => {
    const role = userRoles[projectId];
    if (!role) return null;

    let badgeClass = '';
    let roleName = '';

    switch (role) {
      case 'project_owner':
        badgeClass = 'owner-badge';
        roleName = 'Owner';
        break;
      case 'data_provider':
        badgeClass = 'provider-badge';
        roleName = 'Data Provider';
        break;
      case 'collaborator':
        badgeClass = 'collaborator-badge';
        roleName = 'Collaborator';
        break;
      default:
        return null;
    }

    return <span className={`role-badge ${badgeClass}`}>{roleName}</span>;
  };

  const handleShowTasks = (projectId, e) => {
    e.stopPropagation(); // Prevent triggering the card click event
    // Navigate to tasks page with project ID as a query parameter
    navigate(`/tasks?projectId=${projectId}`);
  };

  const getCardClass = (project) => {
    let classes = "project-card";

    // Add no-data class for red border when the project has no data
    if (!project.hasData) {
      classes += " no-data-card";
    }

    // Add disabled class for collaborators if there's no data
    if (userRoles[project.project_id] === 'collaborator' && !project.hasData) {
      classes += " disabled-card";
    }

    return classes;
  };

  let filteredProjects = projects.filter(proj =>
    proj.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  filteredProjects = filterProjects(filteredProjects);
  filteredProjects = sortProjects(filteredProjects);

  return (
    <div className="projects-page">
      <UserHomeTopBar />
      <div className="projects-container">
        <div className="projects-header">
          <h1>Your Projects</h1>
          <p>Manage and organize your annotation projects</p>
        </div>

        <div className="controls-container">
          <div className="search-bar-container">
            <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-sort-container">
            <div className="filter-dropdown">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="image">Image Annotation</option>
                <option value="video">Video Annotation</option>
                <option value="text">Text Annotation</option>
                <option value="3d">3D Annotation</option>
              </select>
            </div>

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
              className="new-project-btn"
              onClick={() => navigate('/images', { state: { projectMode: true } })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Project
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading projects...</p>
          </div>
        ) : (
          <>
            {filteredProjects.length > 0 ? (
              <div className="projects-grid">
                {filteredProjects.map((proj) => (
                  <div
                    key={proj.project_id}
                    className={getCardClass(proj)}
                    onClick={() => handleProjectClick(proj)}
                  >
                    <div className="project-card-header">
                      <div className="project-type-icon">
                        {getProjectTypeIcon(proj.project_type)}
                      </div>
                      {getRoleBadge(proj.project_id)}
                      <div className="project-actions">
                        {userRoles[proj.project_id] === 'project_owner' && (
                          deleteConfirmation === proj.project_id ? (
                            <>
                              <button
                                className="confirm-delete-btn"
                                onClick={(e) => handleDelete(proj.project_id, e)}
                              >
                                Confirm
                              </button>
                              <button
                                className="cancel-delete-btn"
                                onClick={cancelDelete}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="delete-btn"
                              onClick={(e) => handleDelete(proj.project_id, e)}
                              aria-label="Delete project"
                            >
                              ×
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="project-image">
                      <img
                        src={getProjectThumbnail(proj)}
                        alt={proj.project_name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/placeholder-image.png";
                        }}
                      />
                      {getProjectStatusBadge(proj)}
                    </div>

                    <div className="project-details">
                      <h3 className="project-name" title={proj.project_name}>
                        {proj.project_name}
                      </h3>
                      <p className="project-type">{proj.project_type}</p>
                      <div className="project-meta">
                        <span className="project-meta-item">
                          <span className="meta-icon">🏷️</span>
                          {Array.isArray(proj.label_classes) ? proj.label_classes.length : 0} labels
                        </span>
                        <span className="project-meta-item">
                          <span className="meta-icon">📅</span>
                          {formatDate(proj.created_at)}
                        </span>
                      </div>
                      <div className="project-labels">
                        {Array.isArray(proj.label_classes) && proj.label_classes.length > 0 && (
                          <div className="label-chips">
                            {proj.label_classes.slice(0, 3).map((label, idx) => (
                              <span
                                key={idx}
                                className="label-chip"
                                style={{
                                  backgroundColor: typeof label === 'object' ? label.color : '#e0e0e0'
                                }}
                              >
                                {typeof label === 'object' ? label.name : label}
                              </span>
                            ))}
                            {proj.label_classes.length > 3 && (
                              <span className="more-labels">+{proj.label_classes.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add this at the end of project-details div */}
                      <div className="show-tasks-button-container">
                        <button
                          className="show-tasks-btn"
                          onClick={(e) => handleShowTasks(proj.project_id, e)}
                        >
                          Show Tasks
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-projects-container">
                <div className="no-projects-message">
                  <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  <h3>No projects found</h3>
                  <p>
                    {searchTerm || filterType !== 'all'
                      ? "Try changing your search or filter criteria"
                      : "Create your first project to get started with annotations"}
                  </p>
                  <button
                    className="create-first-project-btn"
                    onClick={() => navigate('/images', { state: { projectMode: true } })}
                  >
                    Create New Project
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}