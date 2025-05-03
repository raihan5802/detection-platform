const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * Save annotations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function saveAnnotations(req, res) {
    try {
        const { folderId, taskId, taskName, labelClasses, annotations } = req.body;

        // Add validation to check if folderId and taskId are defined
        if (!folderId || !taskId) {
            return res.status(400).json({ error: 'Missing required data: folderId and taskId are required' });
        }

        console.log('Saving annotations with:', { folderId, taskId, taskName });

        // Check if task exists in the database
        const taskResult = await pool.query(
            'SELECT task_id FROM tasks WHERE task_id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Store annotations in filesystem (no change here since annotations are stored as files)
        const configDir = path.join(__dirname, '..', '..', 'uploads', folderId, 'annotation-config', taskId);
        fs.mkdirSync(configDir, { recursive: true });
        const annotationsPath = path.join(configDir, 'annotations.json');

        fs.writeFileSync(annotationsPath, JSON.stringify({
            taskName,
            labelClasses,
            annotations,
            lastUpdated: new Date().toISOString()
        }, null, 2));

        // Update annotations status in database
        const annotationStatus = await pool.query(
            `INSERT INTO annotation_status (task_id, folder_id, last_updated)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (task_id, folder_id) 
             DO UPDATE SET last_updated = CURRENT_TIMESTAMP`,
            [taskId, folderId]
        );

        console.log('Annotations saved to', annotationsPath);
        res.json({ message: 'Annotations saved' });
    } catch (error) {
        console.error('Error saving annotations:', error);
        res.status(500).json({ error: 'Failed to save annotations' });
    }
}

/**
 * Get annotations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAnnotations(req, res) {
    try {
        const { folderId, taskId } = req.params;

        // Add validation to check if folderId and taskId are defined
        if (!folderId || !taskId) {
            return res.status(400).json({ error: 'Missing required data: folderId and taskId are required' });
        }

        // Check if task exists in the database
        const taskResult = await pool.query(
            'SELECT task_id FROM tasks WHERE task_id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get the annotations from the filesystem (same as before)
        const annotationsPath = path.join(__dirname, '..', '..', 'uploads', folderId, 'annotation-config', taskId, 'annotations.json');
        if (fs.existsSync(annotationsPath)) {
            const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));

            // Update the last accessed timestamp in the database
            await pool.query(
                `INSERT INTO annotation_status (task_id, folder_id, last_accessed)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (task_id, folder_id) 
                 DO UPDATE SET last_accessed = CURRENT_TIMESTAMP`,
                [taskId, folderId]
            );

            res.json(data);
        } else {
            res.json({ annotations: {} });
        }
    } catch (error) {
        console.error('Error retrieving annotations:', error);
        res.status(500).json({ error: 'Failed to retrieve annotations' });
    }
}

module.exports = {
    saveAnnotations,
    getAnnotations
};