const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const fileUtils = require('../utils/fileUtils');
const { broadcastDataChange } = require('../utils/websocketUtils');

// Use explicit import for utility function
const deleteFolderRecursive = fileUtils.deleteFolderRecursive;

/**
 * Get data access status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getDataAccessStatus(req, res) {
    try {
        const { projectId, userFolder } = req.params;

        // Query the database for access status
        const result = await pool.query(
            'SELECT is_enabled FROM data_access WHERE project_id = $1 AND user_folder = $2',
            [projectId, userFolder]
        );

        // Default to enabled if no record found
        const isEnabled = result.rows.length > 0 ? result.rows[0].is_enabled : true;

        return res.json({ isEnabled });
    } catch (error) {
        console.error('Error fetching data access state:', error);
        res.status(500).json({ error: 'Failed to fetch data access state' });
    }
}

/**
 * Update data access status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateDataAccessStatus(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { projectId, userFolder } = req.params;
        const { isEnabled } = req.body;
        const clients = req.app.locals.clients; // Get WebSocket clients from app locals

        if (isEnabled === undefined) {
            return res.status(400).json({ error: 'isEnabled value is required' });
        }

        // Get the folder ID from project
        const projectResult = await client.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = projectResult.rows[0].folder_path;
        const folderId = folderPath.split('/')[1]; // Extract folder ID from folder_path

        // Upsert the data access record
        await client.query(
            `INSERT INTO data_access (project_id, folder_id, user_folder, is_enabled, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (project_id, user_folder)
             DO UPDATE SET 
                is_enabled = $4,
                updated_at = CURRENT_TIMESTAMP`,
            [projectId, folderId, userFolder, isEnabled]
        );

        // Create a symbolic .access_disabled file to help prevent access at file system level
        const userFolderPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder);
        const accessFlagPath = path.join(userFolderPath, '.access_disabled');

        if (!isEnabled) {
            // Create a marker file indicating access is disabled
            fs.writeFileSync(accessFlagPath, new Date().toISOString());
        } else if (fs.existsSync(accessFlagPath)) {
            // Remove the marker file if access is re-enabled
            fs.unlinkSync(accessFlagPath);
        }

        await client.query('COMMIT');

        // Broadcast the data change to all connected clients
        if (clients) {
            broadcastDataChange(clients, projectId);
        }

        res.json({ message: `Data access ${isEnabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating data access state:', error);
        res.status(500).json({ error: 'Failed to update data access state' });
    } finally {
        client.release();
    }
}

/**
 * Delete user data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteUserData(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { projectId, userFolder } = req.params;
        const clients = req.app.locals.clients; // Get WebSocket clients from app locals

        // Get the folder ID from project
        const projectResult = await client.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = projectResult.rows[0].folder_path;
        const folderId = folderPath.split('/')[1]; // Extract folder ID from folder_path

        // Delete the user folder
        const userFolderPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder);

        if (!fs.existsSync(userFolderPath)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User folder not found' });
        }

        // Delete the folder
        deleteFolderRecursive(userFolderPath);

        // Delete the data access record
        await client.query(
            'DELETE FROM data_access WHERE project_id = $1 AND user_folder = $2',
            [projectId, userFolder]
        );

        await client.query('COMMIT');

        // Broadcast the data change to all connected clients
        if (clients) {
            broadcastDataChange(clients, projectId);
        }

        res.json({ message: 'User data deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting user data:', error);
        res.status(500).json({ error: 'Failed to delete user data' });
    } finally {
        client.release();
    }
}

module.exports = {
    getDataAccessStatus,
    updateDataAccessStatus,
    deleteUserData
};