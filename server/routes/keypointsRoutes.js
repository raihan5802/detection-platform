const express = require('express');
const router = express.Router();
const keypointsController = require('../controllers/keypointsController');

// Save keypoints configuration
router.post('/keypoints-config', keypointsController.saveKeypointsConfig);

// Retrieve keypoints configuration
router.get('/keypoints-config/:folderId/:taskId', keypointsController.getKeypointsConfig);

module.exports = router;