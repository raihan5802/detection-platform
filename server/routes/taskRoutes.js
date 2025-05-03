const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// Create a new task
router.post('/tasks', taskController.createTask);

// Get tasks for a user
router.get('/tasks', taskController.getTasks);

// Get task access level for a specific user
router.get('/task-access/:taskId/:userId', taskController.getTaskAccess);

// Bulk update task access levels
router.put('/task-access/:taskId/bulk-update', taskController.bulkUpdateTaskAccess);

// Delete a task
router.delete('/tasks/:taskId', taskController.deleteTask);

module.exports = router;