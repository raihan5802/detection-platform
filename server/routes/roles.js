const express = require('express');
const roleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRoleAssignment } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/roles
 * @desc Create role assignments
 * @access Private
 */
router.post('/', authenticate, validateRoleAssignment, roleController.createRoles);

/**
 * @route GET /api/roles/project-role/:projectId/:userId
 * @desc Get user's role for a specific project
 * @access Private
 */
router.get('/project-role/:projectId/:userId', authenticate, roleController.getProjectRole);

/**
 * @route GET /api/roles/user-projects/:userId
 * @desc Get all projects a user has access to and their roles
 * @access Private
 */
router.get('/user-projects/:userId', authenticate, roleController.getUserProjects);

/**
 * @route GET /api/roles/project-members/:projectId
 * @desc Get project team members
 * @access Private
 */
router.get('/project-members/:projectId', authenticate, roleController.getProjectMembers);

/**
 * @route POST /api/roles/project-members
 * @desc Add team members to a project
 * @access Private (Project Owner only)
 */
router.post('/project-members', authenticate, authorize(['project_owner']), roleController.addProjectMembers);

/**
 * @route DELETE /api/roles/:roleId
 * @desc Delete a role assignment
 * @access Private (Project Owner only)
 */
router.delete('/:roleId', authenticate, authorize(['project_owner']), roleController.deleteRole);

/**
 * @route POST /api/roles/add-to-project
 * @desc Add a new role assignment to an existing project
 * @access Private (Project Owner only)
 */
router.post('/add-to-project', authenticate, authorize(['project_owner']), validateRoleAssignment, roleController.addRoleToProject);

module.exports = router;