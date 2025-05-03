const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

// Create role assignments
router.post('/roles', roleController.createRoles);

// Delete a role
router.delete('/roles/:roleId', roleController.deleteRole);

// Add a role to an existing project
router.post('/roles/add-to-project', roleController.addRoleToProject);

module.exports = router;