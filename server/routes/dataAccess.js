const express = require('express');
const dataAccessController = require('../controllers/dataAccessController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/data-access/:projectId/:userFolder
 * @desc Get data access status
 * @access Private
 */
router.get('/:projectId/:userFolder', authenticate, dataAccessController.getDataAccessStatus);

/**
 * @route PUT /api/data-access/:projectId/:userFolder
 * @desc Update data access status
 * @access Private (Project Owner or Collaborator only)
 */
router.put('/:projectId/:userFolder', authenticate, authorize(['project_owner', 'collaborator']), dataAccessController.updateDataAccess);

/**
 * @route DELETE /api/data-access/:projectId/:userFolder
 * @desc Delete user data
 * @access Private (Project Owner only)
 */
router.delete('/:projectId/:userFolder', authenticate, authorize(['project_owner']), dataAccessController.deleteUserData);

/**
 * @route GET /api/data-access/project-user-data/:projectId
 * @desc Get list of user folders in a project
 * @access Private
 */
router.get('/project-user-data/:projectId', authenticate, dataAccessController.getProjectUserData);

module.exports = router;