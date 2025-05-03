const express = require('express');
const router = express.Router();
const { multerMiddleware, configureUploadMiddleware } = require('../middleware/uploadMiddleware');
const fileController = require('../controllers/fileController');

// Upload files
router.post('/upload', multerMiddleware.array('files'), fileController.uploadFiles);

// Get folder structure
router.get('/folder-structure/:folderId(*)', fileController.getFolderStructure);

// Get first image in a folder (for thumbnails)
router.get('/first-image', fileController.getFirstImage);

// Delete an image
router.delete('/images/:folderId/*', fileController.deleteImage);

// Upload images to existing folder
router.post('/images/:folderId', configureUploadMiddleware, fileController.uploadImagesToFolder);

// Check if a file exists
router.get('/check-file/:folderId', fileController.checkFileExists);

// Create empty folder
router.post('/create-empty-folder', fileController.createEmptyFolder);

module.exports = router;