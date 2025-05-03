const express = require('express');
const router = express.Router();
const dataAccessController = require('../controllers/dataAccessController');

// Get data access status
router.get('/data-access/:projectId/:userFolder', dataAccessController.getDataAccessStatus);

// Update data access status
router.put('/data-access/:projectId/:userFolder', dataAccessController.updateDataAccessStatus);

// Delete user data
router.delete('/data-access/:projectId/:userFolder', dataAccessController.deleteUserData);

module.exports = router;