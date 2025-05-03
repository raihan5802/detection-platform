const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// Create a new project
router.post('/projects', projectController.createProject);

// Get all projects
router.get('/projects', projectController.getProjects);

// Get project by ID
router.get('/projects/:projectId', projectController.getProjectById);

// Update project labels
router.put('/projects/:projectId/labels', projectController.updateProjectLabels);

// Update project data status
router.put('/projects/:projectId/update-data-status', projectController.updateProjectDataStatus);

// Get project team (users with roles for task assignment)
router.get('/project-team/:projectId', projectController.getProjectTeam);

// Get user's role for a project
router.get('/project-role/:projectId/:userId', projectController.getProjectRole);

// Get all projects a user has access to
router.get('/user-projects/:userId', projectController.getUserProjects);

// Get project members (for team display)
router.get('/project-members/:projectId', projectController.getProjectMembers);

// Add project members
router.post('/project-members', projectController.addProjectMembers);

// Get file count for a project
router.get('/project-file-count/:projectId', projectController.getProjectFileCount);

// Get user data folders for a project
router.get('/project-user-data/:projectId', projectController.getProjectUserData);

// Get all files in a project
router.get('/project-files/:projectId', projectController.getProjectFiles);

// project deletion functionality
router.delete('/projects/:projectId', projectController.deleteProject);

module.exports = router;