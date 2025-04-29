const express = require('express');
const uploadController = require('../controllers/uploadController');
const uploadMiddleware = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const { validateUploadRequest } = require('../middleware/validation');

const router = express.Router();

// Create upload middleware with default options
const upload = uploadMiddleware.createUploadMiddleware();

/**
 * @route POST /api/uploads
 * @desc Upload files
 * @access Private
 */
router.post('/',
    authenticate,
    validateUploadRequest,
    upload.array('files'),
    uploadMiddleware.processUploadedFiles,
    uploadController.handleUpload
);

/**
 * @route POST /api/uploads/notifications/data-upload
 * @desc Send notifications when data is uploaded
 * @access Private
 */
router.post('/notifications/data-upload', authenticate, uploadController.notifyDataUpload);

/**
 * @route POST /api/uploads/create-empty-folder
 * @desc Create an empty folder for projects with no initial files
 * @access Private
 */
router.post('/create-empty-folder', authenticate, uploadController.createEmptyFolder);

/**
 * @route GET /api/uploads/check-file/:folderId
 * @desc Check if a file exists in a folder
 * @access Private
 */
router.get('/check-file/:folderId', authenticate, uploadController.checkFileExists);

/**
 * @route DELETE /api/uploads/images/:folderId/*
 * @desc Delete image from a folder
 * @access Private
 */
router.delete('/images/:folderId/*', authenticate, uploadController.deleteImage);

/**
 * @route POST /api/uploads/images/:folderId
 * @desc Add images to existing folder
 * @access Private
 */
router.post('/images/:folderId',
    authenticate,
    validateUploadRequest,
    upload.array('files'),
    uploadMiddleware.processUploadedFiles,
    uploadController.handleUpload
);

module.exports = router;