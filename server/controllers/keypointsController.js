const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * Store keypoints configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function saveKeypointsConfig(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { folderId, taskId, keypointsData } = req.body;

        if (!folderId || !taskId || !keypointsData) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Create directory if it doesn't exist
        const configDir = path.join(__dirname, '..', '..', 'uploads', folderId, 'keypoints-config');
        fs.mkdirSync(configDir, { recursive: true });

        // Create file with task ID as name
        const configFilePath = path.join(configDir, `${taskId}.json`);

        // Save the keypoints configuration
        fs.writeFileSync(configFilePath, JSON.stringify(keypointsData, null, 2));

        // Record the keypoint configuration in the database
        const configJson = JSON.stringify(keypointsData);

        await client.query(
            `INSERT INTO keypoints_config (task_id, folder_id, config_json)
             VALUES ($1, $2, $3)
             ON CONFLICT (task_id, folder_id) 
             DO UPDATE SET config_json = $3, updated_at = CURRENT_TIMESTAMP`,
            [taskId, folderId, configJson]
        );

        await client.query('COMMIT');

        res.json({ success: true, message: 'Keypoints configuration saved' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving keypoints configuration:', error);
        res.status(500).json({ error: 'Failed to save keypoints configuration' });
    } finally {
        client.release();
    }
}

/**
 * Retrieve keypoints configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getKeypointsConfig(req, res) {
    try {
        const { folderId, taskId } = req.params;

        // Check if the configuration exists in the database
        const result = await pool.query(
            'SELECT config_json FROM keypoints_config WHERE task_id = $1 AND folder_id = $2',
            [taskId, folderId]
        );

        // If found in database, return it
        if (result.rows.length > 0) {
            return res.json(JSON.parse(result.rows[0].config_json));
        }

        // Otherwise, check for the configuration file
        const configFilePath = path.join(__dirname, '..', '..', 'uploads', folderId, 'keypoints-config', `${taskId}.json`);

        if (!fs.existsSync(configFilePath)) {
            return res.status(404).json({ error: 'Keypoints configuration not found' });
        }

        const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

        // Store the configuration in the database for future retrieval
        await pool.query(
            'INSERT INTO keypoints_config (task_id, folder_id, config_json) VALUES ($1, $2, $3)',
            [taskId, folderId, JSON.stringify(configData)]
        );

        res.json(configData);
    } catch (error) {
        console.error('Error retrieving keypoints configuration:', error);
        res.status(500).json({ error: 'Failed to retrieve keypoints configuration' });
    }
}

module.exports = {
    saveKeypointsConfig,
    getKeypointsConfig
};