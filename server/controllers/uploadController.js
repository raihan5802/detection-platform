const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { User, Role, Notification } = require('../models');

// Configure multer storage
const configureStorage = (req, file, cb) => {
    let folderId = req.params.folderId || req.body.folderId;
    if (!folderId) {
        folderId = uuidv4();
        req.body.folderId = folderId;
    }

    // Get current user information
    const userData = req.headers.authorization || req.body.userId;
    let username = 'unknown_user';

    // Extract username from request if available
    if (userData) {
        try {
            if (req.body.userId) {
                User.findByPk(req.body.userId)
                    .then(user => {
                        if (user) {
                            username = user.username.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name

                            // Create user-specific subfolder inside the folderId folder
                            const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

                            // Check if this is a file from folder upload
                            const isFromFolderUpload = file.webkitRelativePath ||
                                (req.body.filePaths &&
                                    Array.isArray(req.body.filePaths) &&
                                    req.body.filePaths.some(p => p.includes('/')));

                            if (!isFromFolderUpload) {
                                const uploadPath = path.join(__dirname, '../../uploads', folderId, userFolder, 'roots');
                                fs.mkdirSync(uploadPath, { recursive: true });
                                cb(null, uploadPath);
                                return;
                            }

                            // For folder uploads
                            let relativePath = '';

                            if (file.webkitRelativePath) {
                                // Use webkitRelativePath if available
                                const pathParts = file.webkitRelativePath.split('/');

                                if (pathParts.length === 2) {
                                    relativePath = 'roots';
                                } else {
                                    pathParts.shift();
                                    pathParts.pop();
                                    relativePath = pathParts.join('/');
                                }
                            } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
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

                            const uploadPath = path.join(__dirname, '../../uploads', folderId, userFolder, relativePath);
                            fs.mkdirSync(uploadPath, { recursive: true });
                            cb(null, uploadPath);
                        } else {
                            const uploadPath = path.join(__dirname, '../../uploads', folderId, 'unknown_user', 'roots');
                            fs.mkdirSync(uploadPath, { recursive: true });
                            cb(null, uploadPath);
                        }
                    })
                    .catch(err => {
                        console.error('Error finding user:', err);
                        const uploadPath = path.join(__dirname, '../../uploads', folderId, 'unknown_user', 'roots');
                        fs.mkdirSync(uploadPath, { recursive: true });
                        cb(null, uploadPath);
                    });
            } else {
                const uploadPath = path.join(__dirname, '../../uploads', folderId, 'unknown_user', 'roots');
                fs.mkdirSync(uploadPath, { recursive: true });
                cb(null, uploadPath);
            }
        } catch (err) {
            console.error('Error parsing user data:', err);
            const uploadPath = path.join(__dirname, '../../uploads', folderId, 'unknown_user', 'roots');
            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
        }
    } else {
        const uploadPath = path.join(__dirname, '../../uploads', folderId, 'unknown_user', 'roots');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    }
};

// Create multer storage configuration
const storage = multer.diskStorage({
    destination: configureStorage,
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// Create multer upload middleware
exports.upload = multer({ storage });

/**
 * Handle file uploads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleUpload = async (req, res) => {
    try {
        const folderId = req.body.folderId;
        const taskName = req.body.taskName || '';
        let labelClasses = [];

        try {
            labelClasses = JSON.parse(req.body.labelClasses);
        } catch (e) {
            labelClasses = [];
        }

        // Process files and preserve folder structure
        const uploadedFiles = req.files.map((f) => {
            // Extract relative path from the file
            let relativePath = '';
            if (f.originalname.includes('/')) {
                // Extract path from file name if multer doesn't preserve it
                relativePath = f.originalname.substring(0, f.originalname.lastIndexOf('/'));
                f.originalname = f.originalname.substring(f.originalname.lastIndexOf('/') + 1);
            } else if (f.webkitRelativePath) {
                // If webkitRelativePath is available
                relativePath = f.webkitRelativePath.split('/').slice(0, -1).join('/');
            }

            return {
                originalname: f.originalname,
                relativePath: relativePath,
                url: `http://localhost:4000/uploads/${folderId}/${relativePath ? relativePath + '/' : ''}${f.originalname}`
            };
        });

        res.json({
            folderId,
            taskName,
            labelClasses,
            files: uploadedFiles,
            message: 'Upload success'
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
};

/**
 * Send notifications when data is uploaded
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.notifyDataUpload = async (req, res) => {
    try {
        const { projectId, uploader, projectName } = req.body;

        // Find project owner and collaborators
        const projectRoles = await Role.findAll({
            where: {
                project_id: projectId,
                role_type: ['project_owner', 'collaborator']
            }
        });

        const timestamp = new Date().toISOString();
        const notifications = [];

        // Create notifications for each recipient
        for (const role of projectRoles) {
            await Notification.create({
                notification_id: uuidv4(),
                user_id: role.user_id,
                message: `${uploader} uploaded data to project "${projectName}"`,
                is_read: false,
                related_project_id: projectId,
                created_at: timestamp
            });
        }

        res.json({ message: 'Data upload notifications sent' });
    } catch (error) {
        console.error('Error sending data upload notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
};

/**
 * Create an empty folder for projects with no initial files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createEmptyFolder = (req, res) => {
    try {
        const folderId = uuidv4();
        const uploadPath = path.join(__dirname, '../../uploads', folderId, 'roots');

        // Create the empty directory structure
        fs.mkdirSync(uploadPath, { recursive: true });

        res.json({
            folderId,
            message: 'Empty project folder created successfully'
        });
    } catch (error) {
        console.error('Error creating empty folder:', error);
        res.status(500).json({ error: 'Failed to create empty project folder' });
    }
};

/**
 * Check if a file exists in a folder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkFileExists = (req, res) => {
    try {
        const { folderId } = req.params;
        const filename = req.query.filename;

        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const filePath = path.join(__dirname, '../../uploads', folderId, 'roots', filename);
        const exists = fs.existsSync(filePath);

        res.json({ exists });
    } catch (error) {
        console.error('Error checking file existence:', error);
        res.status(500).json({ error: 'Failed to check file existence' });
    }
};

/**
 * Delete image from a folder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteImage = (req, res) => {
    const folderId = req.params.folderId;
    const filePathInFolder = req.params[0]; // Everything after :folderId/
    const imagePath = path.join(__dirname, '../../uploads', folderId, filePathInFolder);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        fs.unlinkSync(imagePath);

        // Remove image from annotations if needed
        // This would be handled by the annotations controller

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
};