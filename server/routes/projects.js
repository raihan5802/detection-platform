const express = require('express');
const projectController = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateProjectCreate } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/projects
 * @desc Create a new project
 * @access Private
 */
router.post('/', authenticate, validateProjectCreate, projectController.createProject);

/**
 * @route GET /api/projects
 * @desc Get all projects or filter by userId
 * @access Private
 */
router.get('/', authenticate, projectController.getProjects);

/**
 * @route GET /api/projects/:projectId
 * @desc Get project by ID
 * @access Private
 */
router.get('/:projectId', authenticate, projectController.getProjectById);

/**
 * @route PUT /api/projects/:projectId/labels
 * @desc Update project labels
 * @access Private
 */
router.put('/:projectId/labels', authenticate, authorize(['project_owner', 'collaborator']), projectController.updateProjectLabels);

/**
 * @route PUT /api/projects/:projectId/update-data-status
 * @desc Update project data status
 * @access Private
 */
router.put('/:projectId/update-data-status', authenticate, authorize(['project_owner']), projectController.updateDataStatus);

/**
 * @route GET /api/projects/folder-structure/:folderId
 * @desc Get folder structure recursively
 * @access Private
 */
router.get('/folder-structure/:folderId(*)', authenticate, projectController.getFolderStructure);

/**
 * @route GET /api/projects/file-count/:projectId
 * @desc Get count of files in a project
 * @access Private
 */
router.get('/file-count/:projectId', authenticate, projectController.getProjectFileCount);

/**
 * @route GET /api/projects/files/:projectId
 * @desc Get all files in a project
 * @access Private
 */
router.get('/files/:projectId', authenticate, projectController.getProjectFiles);

module.exports = router;