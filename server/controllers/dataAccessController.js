const { DataAccess, Project } = require('../models');
const path = require('path');
const fs = require('fs');

/**
 * Get data access status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDataAccessStatus = async (req, res) => {
    try {
        const { projectId, userFolder } = req.params;

        const accessRecord = await DataAccess.findOne({
            where: {
                project_id: projectId,
                user_folder: userFolder
            }
        });

        if (!accessRecord) {
            return res.json({ isEnabled: true }); // Default to enabled if no record found
        }

        return res.json({ isEnabled: accessRecord.is_enabled });
    } catch (error) {
        console.error('Error fetching data access state:', error);
        res.status(500).json({ error: 'Failed to fetch data access state' });
    }
};

/**
 * Update data access status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDataAccess = async (req, res) => {
    try {
        const { projectId, userFolder } = req.params;
        const { isEnabled } = req.body;

        if (isEnabled === undefined) {
            return res.status(400).json({ error: 'isEnabled value is required' });
        }

        // Get the folder ID from the project record
        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = project.folder_path;
        const parts = folderPath.split('/');
        const folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"

        // Find or create the data access record
        const [accessRecord, created] = await DataAccess.findOrCreate({
            where: {
                project_id: projectId,
                user_folder: userFolder
            },
            defaults: {
                folder_id: folderId,
                is_enabled: isEnabled,
                updated_at: new Date().toISOString()
            }
        });

        if (!created) {
            // Update existing record
            accessRecord.is_enabled = isEnabled;
            accessRecord.updated_at = new Date().toISOString();
            await accessRecord.save();
        }

        // Create a symbolic .access_disabled file to help prevent access at file system level
        const folderPathFull = path.join(__dirname, '../../uploads', folderId, userFolder);
        const accessFlagPath = path.join(folderPathFull, '.access_disabled');

        if (!isEnabled) {
            // Create a marker file indicating access is disabled
            fs.writeFileSync(accessFlagPath, new Date().toISOString());
        } else if (fs.existsSync(accessFlagPath)) {
            // Remove the marker file if access is re-enabled
            fs.unlinkSync(accessFlagPath);
        }

        // Broadcast the data change to all connected clients would be handled via WebSockets

        res.json({ message: `Data access ${isEnabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        console.error('Error updating data access state:', error);
        res.status(500).json({ error: 'Failed to update data access state' });
    }
};

/**
 * Delete user data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteUserData = async (req, res) => {
    try {
        const { projectId, userFolder } = req.params;

        // Get the folder ID from the project record
        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = project.folder_path;
        const parts = folderPath.split('/');
        const folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"

        // Delete the user folder
        const folderPathFull = path.join(__dirname, '../../uploads', folderId, userFolder);

        if (!fs.existsSync(folderPathFull)) {
            return res.status(404).json({ error: 'User folder not found' });
        }

        // Function to recursively delete directory
        const deleteFolderRecursive = (dirPath) => {
            if (fs.existsSync(dirPath)) {
                fs.readdirSync(dirPath).forEach((file) => {
                    const curPath = path.join(dirPath, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        // Recursive call
                        deleteFolderRecursive(curPath);
                    } else {
                        // Delete file
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(dirPath);
            }
        };

        // Delete the folder
        deleteFolderRecursive(folderPathFull);

        // Delete the access record
        await DataAccess.destroy({
            where: {
                project_id: projectId,
                user_folder: userFolder
            }
        });

        // Broadcast the data change to all connected clients would be handled via WebSockets

        res.json({ message: 'User data deleted successfully' });
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).json({ error: 'Failed to delete user data' });
    }
};

/**
 * Get list of user folders in a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectUserData = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.query.userId; // Optional user ID to filter by

        // Get the project to find folder path
        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = project.folder_path;
        const parts = folderPath.split('/');
        const folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"

        const projectDir = path.join(__dirname, '../../uploads', folderId);

        if (!fs.existsSync(projectDir)) {
            return res.json([]);
        }

        // Read the folder to find user subfolders
        const items = fs.readdirSync(projectDir);

        // Get username for the requesting user if filtering is needed
        let requestingUsername = null;
        if (userId) {
            const user = await User.findByPk(userId);
            if (user) {
                requestingUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
            }
        }

        // Filter user folders
        let userFolders = items.filter(item => {
            const fullPath = path.join(projectDir, item);
            const isUserFolder = fs.statSync(fullPath).isDirectory() && item.includes('_20'); // Match pattern username_YYYYMMDD

            // If userId is provided, only return their own folders
            if (userId && requestingUsername) {
                return isUserFolder && item.startsWith(requestingUsername + '_');
            }

            return isUserFolder;
        });

        // Get access status for each folder
        const accessRecords = await DataAccess.findAll({
            where: { project_id: projectId }
        });

        const accessStatuses = {};
        accessRecords.forEach(record => {
            accessStatuses[record.user_folder] = record.is_enabled;
        });

        // Create the response with user information
        const userFolderInfo = userFolders.map(folderName => {
            const parts = folderName.split('_');
            const username = parts[0];
            const uploadDate = parts.length > 1 ? parts[1] : null;

            // Count files
            let fileCount = 0;
            const countFiles = (dir) => {
                if (!fs.existsSync(dir)) return 0;
                const dirItems = fs.readdirSync(dir);
                dirItems.forEach(item => {
                    const itemPath = path.join(dir, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        fileCount += countFiles(itemPath);
                    } else if (fs.statSync(itemPath).isFile() && !item.startsWith('.')) {
                        fileCount++;
                    }
                });
                return fileCount;
            };

            countFiles(path.join(projectDir, folderName));

            return {
                folderName,
                username,
                uploadDate: uploadDate ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}` : null,
                isEnabled: accessStatuses[folderName] !== undefined ? accessStatuses[folderName] : true,
                fileCount
            };
        });

        res.json(userFolderInfo);
    } catch (error) {
        console.error('Error fetching project user data:', error);
        res.status(500).json({ error: 'Failed to fetch project user data' });
    }
};