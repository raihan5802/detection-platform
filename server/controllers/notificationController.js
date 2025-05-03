const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

/**
 * Create a notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createNotification(req, res) {
    try {
        const { userId, message, related_project_id } = req.body;

        // Validate required fields
        if (!userId || !message) {
            return res.status(400).json({ error: 'User ID and message are required' });
        }

        // Generate a unique notification ID
        const notificationId = uuidv4();

        // Insert notification into database
        const result = await pool.query(
            'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [notificationId, userId, message, false, related_project_id || null]
        );

        res.json({
            notificationId,
            message: 'Notification created successfully'
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
}

/**
 * Send notifications when data is uploaded
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createDataUploadNotifications(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { projectId, uploader, projectName } = req.body;

        // Validate required fields
        if (!projectId || !uploader || !projectName) {
            return res.status(400).json({ error: 'Project ID, uploader, and project name are required' });
        }

        // Find project owners and collaborators
        const rolesQuery = `
            SELECT user_id, role_type 
            FROM roles 
            WHERE project_id = $1 AND role_type IN ('project_owner', 'collaborator')
        `;

        const rolesResult = await client.query(rolesQuery, [projectId]);

        // Create notifications for each user
        const message = `${uploader} uploaded data to project "${projectName}"`;

        for (const role of rolesResult.rows) {
            const notificationId = uuidv4();

            await client.query(
                'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                [notificationId, role.user_id, message, false, projectId]
            );
        }

        await client.query('COMMIT');

        res.json({
            message: 'Data upload notifications sent',
            notificationCount: rolesResult.rows.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending data upload notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    } finally {
        client.release();
    }
}

/**
 * Get notifications for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserNotifications(req, res) {
    try {
        const { userId } = req.params;

        // Retrieve notifications from database, sorted by creation date (newest first)
        const query = `
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        // Transform the results to match the expected format
        const notifications = result.rows.map(row => ({
            notification_id: row.notification_id,
            user_id: row.user_id,
            message: row.message,
            is_read: row.is_read,
            related_project_id: row.related_project_id,
            created_at: row.created_at
        }));

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
}

/**
 * Mark a notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function markNotificationAsRead(req, res) {
    try {
        const { notificationId } = req.params;

        // Update the notification's is_read status
        const result = await pool.query(
            'UPDATE notifications SET is_read = true WHERE notification_id = $1 RETURNING *',
            [notificationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
}

module.exports = {
    createNotification,
    createDataUploadNotifications,
    getUserNotifications,
    markNotificationAsRead
};