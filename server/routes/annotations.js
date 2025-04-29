const express = require('express');
const annotationController = require('../controllers/annotationController');
const { authenticate, authorizeTaskAccess } = require('../middleware/auth');
const { validateAnnotationSave } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/annotations
 * @desc Save annotations for a task
 * @access Private (Editor only)
 */
router.post('/', authenticate, authorizeTaskAccess(['editor']), validateAnnotationSave, annotationController.saveAnnotations);

/**
 * @route GET /api/annotations/:folderId/:taskId
 * @desc Get annotations for a task
 * @access Private (Editor or Viewer)
 */
router.get('/:folderId/:taskId', authenticate, authorizeTaskAccess(['editor', 'viewer']), annotationController.getAnnotations);

/**
 * @route POST /api/annotations/keypoints-config
 * @desc Store keypoints configuration
 * @access Private (Editor only)
 */
router.post('/keypoints-config', authenticate, authorizeTaskAccess(['editor']), annotationController.saveKeypointsConfig);

/**
 * @route GET /api/annotations/keypoints-config/:folderId/:taskId
 * @desc Retrieve keypoints configuration
 * @access Private (Editor or Viewer)
 */
router.get('/keypoints-config/:folderId/:taskId', authenticate, authorizeTaskAccess(['editor', 'viewer']), annotationController.getKeypointsConfig);

/**
 * @route DELETE /api/annotations/:folderId/:taskId/:imageUrl
 * @desc Delete annotation for a specific image
 * @access Private (Editor only)
 */
router.delete('/:folderId/:taskId/:imageUrl', authenticate, authorizeTaskAccess(['editor']), annotationController.deleteAnnotation);

/**
 * @route GET /api/annotations/export/:folderId/:taskId/:format
 * @desc Export annotations in a specific format
 * @access Private (Editor or Viewer)
 */
router.get('/export/:folderId/:taskId/:format', authenticate, authorizeTaskAccess(['editor', 'viewer']), annotationController.exportAnnotations);

module.exports = router;