const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');

/**
 * Configure multer storage for file uploads
 * @param {Object} options - Options for configuring storage
 * @returns {Object} Configured multer storage
 */
exports.configureStorage = (options = {}) => {
    const storage = multer.diskStorage({
        destination: async (req, file, cb) => {
            try {
                // Get or generate folderId
                let folderId = req.params.folderId || req.body.folderId;
                if (!folderId) {
                    folderId = uuidv4();
                    req.body.folderId = folderId;
                }

                // Get user information
                const userId = req.headers.userId || req.body.userId;
                let username = 'unknown_user';

                if (userId) {
                    // Look up user from database
                    const user = await User.findByPk(userId);
                    if (user) {
                        username = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
                    }
                }

                // Create user-specific subfolder with date
                const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

                // Determine if this is a folder upload or a regular file upload
                const isFromFolderUpload = file.webkitRelativePath ||
                    (req.body.filePaths &&
                        Array.isArray(req.body.filePaths) &&
                        req.body.filePaths.some(p => p.includes('/')));

                // For regular file uploads
                if (!isFromFolderUpload) {
                    const uploadPath = path.join(__dirname, '../../uploads', folderId, userFolder, 'roots');
                    fs.mkdirSync(uploadPath, { recursive: true });
                    cb(null, uploadPath);
                    return;
                }

                // For folder uploads
                let relativePath = '';

                if (file.webkitRelativePath) {
                    // Get path from webkitRelativePath
                    const pathParts = file.webkitRelativePath.split('/');

                    if (pathParts.length === 2) {
                        relativePath = 'roots';
                    } else {
                        pathParts.shift();
                        pathParts.pop();
                        relativePath = pathParts.join('/');
                    }
                } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
                    // Get path from filePaths array
                    const filePath = req.body.filePaths.find(p => p.includes(file.originalname));

                    if (filePath) {
                        const pathParts = filePath.split('/');

                        if (pathParts.length === 2) {
                            relativePath = 'roots';
                        } else {
                            pathParts.shift();
                            pathParts.pop();
                            relativePath = pathParts.join('/');
                        }
                    } else {
                        relativePath = 'roots';
                    }
                } else {
                    relativePath = 'roots';
                }

                // Create full upload path
                const uploadPath = path.join(__dirname, '../../uploads', folderId, userFolder, relativePath);
                fs.mkdirSync(uploadPath, { recursive: true });
                cb(null, uploadPath);
            } catch (error) {
                console.error('Error configuring upload destination:', error);
                cb(error);
            }
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });

    return storage;
};

/**
 * Create multer upload middleware
 * @param {Object} options - Options for configuring upload
 * @returns {Object} Configured multer middleware
 */
exports.createUploadMiddleware = (options = {}) => {
    const storage = this.configureStorage(options);
    const limits = options.limits || {
        fileSize: 100 * 1024 * 1024 // 100MB file size limit by default
    };

    return multer({
        storage,
        limits,
        fileFilter: (req, file, cb) => {
            // Validate file types if specified
            if (options.allowedFileTypes && options.allowedFileTypes.length > 0) {
                const ext = path.extname(file.originalname).toLowerCase();
                if (options.allowedFileTypes.includes(ext)) {
                    return cb(null, true);
                }
                return cb(new Error('File type not allowed'));
            }

            // Allow all files if no allowedFileTypes specified
            cb(null, true);
        }
    });
};

/**
 * Middleware to handle validation of upload request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateUploadRequest = (req, res, next) => {
    if (!req.body.userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    next();
};

/**
 * Middleware to process uploaded files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.processUploadedFiles = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded' });
    }

    // Extract folder ID for use in later middleware
    req.uploadFolderId = req.body.folderId;

    // Generate URLs for uploaded files
    req.uploadedFiles = req.files.map(file => {
        // Calculate relative path from upload directory
        const uploadDir = path.join(__dirname, '../../uploads', req.uploadFolderId);
        const relativePath = path.relative(uploadDir, file.path);

        return {
            originalname: file.originalname,
            filename: file.filename,
            path: file.path,
            relativePath,
            url: `http://localhost:4000/uploads/${req.uploadFolderId}/${relativePath}`
        };
    });

    next();
};