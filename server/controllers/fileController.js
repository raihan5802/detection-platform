const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const fileUtils = require('../utils/fileUtils');

// Use explicit imports
const findFirstImage = fileUtils.findFirstImage;
const readDirRecursive = fileUtils.readDirRecursive;
const deleteFolderRecursive = fileUtils.deleteFolderRecursive;

/**
 * Upload files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadFiles(req, res) {
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
                // If webkitRelativePath is available (might need middleware to preserve)
                relativePath = f.webkitRelativePath.split('/').slice(0, -1).join('/');
            }

            return {
                originalname: f.originalname,
                relativePath: relativePath,
                url: `http://localhost:4000/uploads/${folderId}/${relativePath ? relativePath + '/' : ''}${f.originalname}`
            };
        });

        // Record the upload in the database
        if (uploadedFiles.length > 0) {
            const filesJson = JSON.stringify(uploadedFiles.map(file => ({
                name: file.originalname,
                path: file.relativePath,
                url: file.url
            })));

            await pool.query(
                'INSERT INTO file_uploads (folder_id, file_count, files_json) VALUES ($1, $2, $3)',
                [folderId, uploadedFiles.length, filesJson]
            );
        }

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
}

/**
 * Get folder structure
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getFolderStructure(req, res) {
    try {
        const folderId = decodeURIComponent(req.params.folderId);
        const basePath = path.join(__dirname, '..', '..', 'uploads', folderId);

        if (!fs.existsSync(basePath)) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const tree = {
            name: path.basename(basePath),
            type: 'folder',
            children: readDirRecursive(basePath)
        };

        res.json(tree);
    } catch (error) {
        console.error('Error getting folder structure:', error);
        res.status(500).json({ error: 'Failed to get folder structure' });
    }
}

/**
 * Get first image in a folder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getFirstImage(req, res) {
    try {
        const folderPath = req.query.folderPath; // e.g. "61c36569-7d69-4654-8516-22d40d4b24a6/test_imag3"
        if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
        const basePath = path.join(__dirname, '..', '..', 'uploads', folderPath);
        if (!fs.existsSync(basePath)) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const imageFile = findFirstImage(basePath);
        if (imageFile) {
            return res.json({ imageUrl: `uploads/${folderPath}/${imageFile}` });
        } else {
            return res.status(404).json({ error: 'No image found in folder' });
        }
    } catch (error) {
        console.error('Error finding first image:', error);
        res.status(500).json({ error: 'Failed to find first image' });
    }
}

/**
 * Delete an image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteImage(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const folderId = req.params.folderId;
        const filePathInFolder = req.params[0]; // Everything after :folderId/
        const imagePath = path.join(__dirname, '..', '..', 'uploads', folderId, filePathInFolder);

        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete the file from filesystem
        fs.unlinkSync(imagePath);

        // Record the file deletion in the database
        await client.query(
            'INSERT INTO file_deletions (folder_id, file_path) VALUES ($1, $2)',
            [folderId, filePathInFolder]
        );

        // Remove image from annotations if taskId provided
        const taskId = req.query.taskId;
        if (taskId) {
            const annotationsPath = path.join(__dirname, '..', '..', 'uploads', folderId, 'annotation-config', taskId, 'annotations.json');
            if (fs.existsSync(annotationsPath)) {
                const annotations = JSON.parse(fs.readFileSync(annotationsPath));
                const imageUrl = `http://localhost:4000/uploads/${folderId}/${filePathInFolder}`;

                if (annotations.annotations && annotations.annotations[imageUrl]) {
                    delete annotations.annotations[imageUrl];
                    fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));

                    // Record annotation update in database
                    await client.query(
                        `INSERT INTO annotation_status (task_id, folder_id, last_updated)
                         VALUES ($1, $2, CURRENT_TIMESTAMP)
                         ON CONFLICT (task_id, folder_id) 
                         DO UPDATE SET last_updated = CURRENT_TIMESTAMP`,
                        [taskId, folderId]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    } finally {
        client.release();
    }
}

/**
 * Upload images to existing folder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadImagesToFolder(req, res) {
    try {
        const folderId = req.params.folderId;
        const userFolder = req.userFolder;

        const uploadedFiles = req.files.map((f) => {
            // Handle both files and folders by preserving path structure
            let relativePath;
            if (f.originalWebkitRelativePath || f.webkitRelativePath) {
                relativePath = f.originalWebkitRelativePath || f.webkitRelativePath;
            } else {
                relativePath = `roots/${f.originalname}`;
            }

            // Include the user folder in the URL path
            return {
                originalname: f.originalname,
                path: relativePath,
                url: `http://localhost:4000/uploads/${folderId}/${userFolder}/${relativePath}`
            };
        });

        // Record the upload in the database
        if (uploadedFiles.length > 0) {
            const filesJson = JSON.stringify(uploadedFiles.map(file => ({
                name: file.originalname,
                path: file.path,
                url: file.url
            })));

            await pool.query(
                'INSERT INTO file_uploads (folder_id, user_folder, file_count, files_json) VALUES ($1, $2, $3, $4)',
                [folderId, userFolder, uploadedFiles.length, filesJson]
            );
        }

        res.json({
            files: uploadedFiles,
            message: 'Upload success'
        });
    } catch (error) {
        console.error('Error uploading images to folder:', error);
        res.status(500).json({ error: 'Failed to upload images to folder' });
    }
}

/**
 * Check if a file exists
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function checkFileExists(req, res) {
    try {
        const { folderId } = req.params;
        const filename = req.query.filename;

        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const filePath = path.join(__dirname, '..', '..', 'uploads', folderId, 'roots', filename);
        const exists = fs.existsSync(filePath);

        res.json({ exists });
    } catch (error) {
        console.error('Error checking file existence:', error);
        res.status(500).json({ error: 'Failed to check file existence' });
    }
}

/**
 * Create an empty folder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createEmptyFolder(req, res) {
    try {
        const folderId = uuidv4();
        const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, 'roots');

        // Create the empty directory structure
        fs.mkdirSync(uploadPath, { recursive: true });

        // Record the folder creation in the database
        await pool.query(
            'INSERT INTO folder_creation (folder_id) VALUES ($1)',
            [folderId]
        );

        res.json({
            folderId,
            message: 'Empty project folder created successfully'
        });
    } catch (error) {
        console.error('Error creating empty folder:', error);
        res.status(500).json({ error: 'Failed to create empty project folder' });
    }
}

module.exports = {
    uploadFiles,
    getFolderStructure,
    getFirstImage,
    deleteImage,
    uploadImagesToFolder,
    checkFileExists,
    createEmptyFolder
};