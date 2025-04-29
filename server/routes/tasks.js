const express = require('express');
const taskController = require('../controllers/taskController');
const { authenticate, authorizeTaskAccess } = require('../middleware/auth');
const { validateTaskCreate, validateTaskAccessUpdate } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/tasks
 * @desc Create a new task
 * @access Private
 */
router.post('/', authenticate, validateTaskCreate, taskController.createTask);

/**
 * @route GET /api/tasks
 * @desc Get tasks for a user
 * @access Private
 */
router.get('/', authenticate, taskController.getTasks);

/**
 * @route GET /api/tasks/task-access/:taskId/:userId
 * @desc Get task access level for a user
 * @access Private
 */
router.get('/task-access/:taskId/:userId', authenticate, taskController.getTaskAccess);

/**
 * @route PUT /api/tasks/task-access/:taskId/bulk-update
 * @desc Bulk update task access levels
 * @access Private (Editor only)
 */
router.put('/task-access/:taskId/bulk-update',
    authenticate,
    authorizeTaskAccess(['editor']),
    validateTaskAccessUpdate,
    taskController.bulkUpdateTaskAccess
);

/**
 * @route GET /api/tasks/project-team/:projectId
 * @desc Get project team members for task assignment
 * @access Private
 */
router.get('/project-team/:projectId', authenticate, taskController.getProjectTeam);

/**
 * @route GET /api/tasks/first-image
 * @desc Find first image in a folder for task card
 * @access Private
 */
router.get('/first-image', authenticate, taskController.getFirstImage);

module.exports = router;