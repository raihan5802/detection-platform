const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

// Middleware to check file access permissions
const fileAccessMiddleware = async (req, res, next) => {
    const urlPath = req.path;
    const parts = urlPath.split('/');

    // We need at least [0:empty, 1:folderId, 2:userFolder, ...] to check access
    if (parts.length < 3) {
        return next(); // Let it go through if it's a direct access to the folderId level
    }

    const folderId = parts[1];
    const userFolder = parts[2];

    // // Skip access check if userFolder doesn't match our pattern (username_YYYYMMDD)
    // if (!userFolder.includes('_20')) {
    //     return next();
    // }

    try {
        // Find project ID for this folder
        const projectResult = await pool.query(
            'SELECT project_id FROM projects WHERE folder_path LIKE $1',
            [`%/${folderId}%`]
        );

        if (projectResult.rows.length === 0) {
            return next(); // Unable to find project, let it through
        }

        const projectId = projectResult.rows[0].project_id;

        // Check for access flag file
        const accessFlagPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, '.access_disabled');
        if (fs.existsSync(accessFlagPath)) {
            // Return 404 Not Found instead of 403 Forbidden to make it look like the file doesn't exist
            return res.status(404).send('Not Found');
        }

        // Check data_access table for explicit access control
        const accessResult = await pool.query(
            'SELECT is_enabled FROM data_access WHERE project_id = $1 AND user_folder = $2',
            [projectId, userFolder]
        );

        if (accessResult.rows.length > 0) {
            const isEnabled = accessResult.rows[0].is_enabled;
            if (!isEnabled) {
                // Return 404 Not Found instead of 403 Forbidden
                return res.status(404).send('Not Found');
            }
        }

        next(); // Access is allowed
    } catch (error) {
        console.error('Error checking file access:', error);
        next(); // In case of error, default to allowing access
    }
};

module.exports = {
    fileAccessMiddleware
};