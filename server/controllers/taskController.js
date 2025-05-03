// database implementation - server/controller/taskController.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

/**
 * Create a new task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createTask(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { userId, projectId, taskName, projectName, annotationType, selectedFolders, teamAccess } = req.body;

        // Validate required fields
        if (!userId || !projectId || !taskName || !projectName || !annotationType || !selectedFolders) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Extract only the folder paths that were checked
        const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
        if (selectedFolderPaths.length === 0) {
            return res.status(400).json({ error: "At least one folder must be selected" });
        }

        const taskId = uuidv4();

        // Convert the array to a proper JSON object for PostgreSQL
        const selectedFilesJson = JSON.stringify(selectedFolderPaths);

        // Insert task into database - using JSON format for selected_files
        await client.query(
            'INSERT INTO tasks (task_id, user_id, project_id, task_name, project_name, annotation_type, selected_files) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [taskId, userId, projectId, taskName, projectName, annotationType, selectedFilesJson]
        );

        // Process team access permissions if provided
        if (teamAccess && Object.keys(teamAccess).length > 0) {
            // Add project owner as editor by default
            await client.query(
                'INSERT INTO task_access (task_id, user_id, access_level, assigned_by) VALUES ($1, $2, $3, $4)',
                [taskId, userId, 'editor', userId]
            );

            // Add team access for other members
            for (const [memberId, accessLevel] of Object.entries(teamAccess)) {
                if (memberId !== userId) { // Skip if it's the owner (already added)
                    await client.query(
                        'INSERT INTO task_access (task_id, user_id, access_level, assigned_by) VALUES ($1, $2, $3, $4)',
                        [taskId, memberId, accessLevel, userId]
                    );
                }

                // Send notifications to team members
                if (accessLevel !== 'no_access') {
                    // Get project owner's username
                    const userResult = await client.query(
                        'SELECT username FROM users WHERE id = $1',
                        [userId]
                    );

                    let ownerUsername = "A team member";
                    if (userResult.rows.length > 0) {
                        ownerUsername = userResult.rows[0].username;
                    }

                    // Create notification with notification_id
                    const notificationId = uuidv4();
                    await client.query(
                        'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                        [notificationId, memberId, `${ownerUsername} gave you ${accessLevel} access to task "${taskName}"`, false, projectId]
                    );
                }
            }
        } else {
            // If no explicit access is provided, add the project owner as editor
            await client.query(
                'INSERT INTO task_access (task_id, user_id, access_level, assigned_by) VALUES ($1, $2, $3, $4)',
                [taskId, userId, 'editor', userId]
            );
        }

        await client.query('COMMIT');

        res.json({ taskId, message: "Task created successfully" });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating task:", error);
        res.status(500).json({ error: "Failed to create task" });
    } finally {
        client.release();
    }
}

/**
 * Get tasks for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTasks(req, res) {
    try {
        // Get userId from query
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // Query for tasks user has access to
        const query = `
            WITH user_task_access AS (
                -- Tasks user created (always has editor access)
                SELECT 
                    t.task_id, 
                    'editor' AS access_level
                FROM 
                    tasks t
                WHERE 
                    t.user_id = $1
                
                UNION
                
                -- Tasks user has explicit access to
                SELECT 
                    ta.task_id, 
                    ta.access_level
                FROM 
                    task_access ta
                WHERE 
                    ta.user_id = $1 
                    AND ta.access_level != 'no_access'
            )
            
            SELECT 
                t.task_id,
                t.user_id,
                t.project_id,
                t.task_name,
                t.project_name,
                t.annotation_type,
                t.selected_files,
                t.created_at,
                uta.access_level
            FROM 
                tasks t
            JOIN 
                user_task_access uta ON t.task_id = uta.task_id
            ORDER BY 
                t.created_at DESC;
        `;

        const result = await pool.query(query, [userId]);

        // Format the results - convert JSON selected_files to semicolon-separated string for client compatibility
        const accessibleTasks = result.rows.map(row => {
            let selectedFiles = row.selected_files;

            // Convert from JSON array to semicolon-separated string for frontend compatibility
            if (selectedFiles) {
                if (Array.isArray(selectedFiles)) {
                    selectedFiles = selectedFiles.join(';');
                } else if (typeof selectedFiles === 'object') {
                    // If it's a JSON object, stringify it
                    selectedFiles = JSON.stringify(selectedFiles);
                } else if (typeof selectedFiles === 'string') {
                    // If it's already a string, try to parse it as JSON first
                    try {
                        const parsedJson = JSON.parse(selectedFiles);
                        if (Array.isArray(parsedJson)) {
                            selectedFiles = parsedJson.join(';');
                        }
                    } catch (e) {
                        // If it's not valid JSON, it might already be a semicolon string
                    }
                }
            }

            return {
                task_id: row.task_id,
                user_id: row.user_id,
                project_id: row.project_id,
                task_name: row.task_name,
                project_name: row.project_name,
                annotation_type: row.annotation_type,
                selected_files: selectedFiles,
                created_at: row.created_at,
                access_level: row.access_level
            };
        });

        res.json(accessibleTasks);
    } catch (error) {
        console.error("Error reading tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
}

/**
 * Get task access level for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTaskAccess(req, res) {
    try {
        const { taskId, userId } = req.params;

        // Check if user is the task creator
        const taskResult = await pool.query(
            'SELECT user_id FROM tasks WHERE task_id = $1',
            [taskId]
        );

        if (taskResult.rows.length > 0 && taskResult.rows[0].user_id === userId) {
            // Task creator always has editor access
            return res.json({ access_level: 'editor' });
        }

        // Check task_access for this user
        const accessResult = await pool.query(
            'SELECT access_level FROM task_access WHERE task_id = $1 AND user_id = $2',
            [taskId, userId]
        );

        if (accessResult.rows.length > 0) {
            return res.json({ access_level: accessResult.rows[0].access_level });
        }

        // Default to no access if not found
        res.json({ access_level: 'no_access' });
    } catch (error) {
        console.error('Error fetching task access:', error);
        res.status(500).json({ error: 'Failed to fetch task access' });
    }
}

/**
 * Bulk update task access levels
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function bulkUpdateTaskAccess(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { taskId } = req.params;
        const { accessLevels, assignedBy } = req.body;

        if (!taskId || !assignedBy || !accessLevels || typeof accessLevels !== 'object') {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify the task exists and get its data
        const taskResult = await client.query(
            'SELECT task_id, user_id, project_id, task_name FROM tasks WHERE task_id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const taskData = taskResult.rows[0];

        // Verify user has permission to update access
        if (taskData.user_id !== assignedBy) {
            // Check if user has editor access
            const accessResult = await client.query(
                'SELECT access_level FROM task_access WHERE task_id = $1 AND user_id = $2',
                [taskId, assignedBy]
            );

            if (accessResult.rows.length === 0 || accessResult.rows[0].access_level !== 'editor') {
                return res.status(403).json({ error: 'You do not have permission to update access levels' });
            }
        }

        // Get original access levels to compare for notifications
        const originalAccessResult = await client.query(
            'SELECT user_id, access_level FROM task_access WHERE task_id = $1',
            [taskId]
        );

        const originalAccess = {};
        originalAccessResult.rows.forEach(row => {
            originalAccess[row.user_id] = row.access_level;
        });

        // Get assigner's username
        const assignerResult = await client.query(
            'SELECT username FROM users WHERE id = $1',
            [assignedBy]
        );

        let assignerUsername = "A team member";
        if (assignerResult.rows.length > 0) {
            assignerUsername = assignerResult.rows[0].username;
        }

        // Delete existing access levels for this task
        await client.query(
            'DELETE FROM task_access WHERE task_id = $1',
            [taskId]
        );

        // Add updated access levels
        const userIdsToNotify = new Set();

        for (const [userId, accessLevel] of Object.entries(accessLevels)) {
            if (['editor', 'viewer', 'no_access'].includes(accessLevel)) {
                await client.query(
                    'INSERT INTO task_access (task_id, user_id, access_level, assigned_by) VALUES ($1, $2, $3, $4)',
                    [taskId, userId, accessLevel, assignedBy]
                );

                // Check if user's access has changed and needs notification
                const oldAccessLevel = originalAccess[userId] || 'no_access';

                if (accessLevel !== oldAccessLevel && accessLevel !== 'no_access') {
                    userIdsToNotify.add(userId);

                    const notificationId = uuidv4(); // Generate notification ID
                    await client.query(
                        'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                        [
                            notificationId,
                            userId,
                            `${assignerUsername} gave you ${accessLevel} access to task "${taskData.task_name}"`,
                            false,
                            taskData.project_id
                        ]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Access levels updated successfully',
            updatedCount: Object.keys(accessLevels).length,
            notifiedUsers: Array.from(userIdsToNotify)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating task access levels:', error);
        res.status(500).json({ error: 'Failed to update access levels' });
    } finally {
        client.release();
    }
}

/**
 * Delete a task and its associated records
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteTask(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { taskId } = req.params;
        const userId = req.query.userId;

        console.log(`Attempting to delete task ${taskId} by user ${userId}`);

        // Get task information and verify ownership if userId provided
        const taskQuery = userId
            ? 'SELECT * FROM tasks WHERE task_id = $1 AND user_id = $2'
            : 'SELECT * FROM tasks WHERE task_id = $1';

        const taskParams = userId ? [taskId, userId] : [taskId];
        const taskResult = await client.query(taskQuery, taskParams);

        if (taskResult.rows.length === 0) {
            if (userId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Only task owners can delete tasks' });
            } else {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Task not found' });
            }
        }

        const taskData = taskResult.rows[0];
        console.log(`Found task: ${taskData.task_name}`);

        // Delete task access records for this task
        await client.query('DELETE FROM task_access WHERE task_id = $1', [taskId]);
        console.log('Task access records deleted');

        // Delete the task
        await client.query('DELETE FROM tasks WHERE task_id = $1', [taskId]);
        console.log('Task deleted');

        await client.query('COMMIT');

        res.json({
            message: 'Task deleted successfully',
            taskName: taskData.task_name
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    } finally {
        client.release();
    }
}

module.exports = {
    createTask,
    getTasks,
    getTaskAccess,
    bulkUpdateTaskAccess,
    deleteTask
};