const express = require('express');
const router = express.Router();
const annotationController = require('../controllers/annotationController');

// Add validation middleware to check request body
function validateAnnotationRequest(req, res, next) {
    const { folderId, taskId } = req.body;

    if (!folderId || !taskId) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'Both folderId and taskId are required'
        });
    }

    next();
}

// Save annotations
router.post('/annotations', validateAnnotationRequest, annotationController.saveAnnotations);

// Get annotations
router.get('/annotations/:folderId/:taskId', annotationController.getAnnotations);

module.exports = router;