// database implementation - server/controller/roleController.js

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

/**
 * Create role assignments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createRoles(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { projectId, ownerId, dataProviderId, collaboratorId } = req.body;

        // Check if roles already exist to avoid duplicates
        const existingRolesQuery = 'SELECT user_id, role_type FROM roles WHERE project_id = $1';
        const existingRolesResult = await client.query(existingRolesQuery, [projectId]);

        const existingRoles = new Map();
        existingRolesResult.rows.forEach(row => {
            existingRoles.set(`${row.user_id}_${row.role_type}`, true);
        });

        const rolesToAdd = [];
        const rolesAdded = [];

        // Check and add owner role if it doesn't exist
        if (!existingRoles.has(`${ownerId}_project_owner`)) {
            const roleId = uuidv4();
            rolesToAdd.push({
                roleId,
                projectId,
                userId: ownerId,
                roleType: 'project_owner',
                assignedBy: 'system'
            });
            rolesAdded.push('project_owner');
        }

        // Check and add data provider role if provided and doesn't exist
        if (dataProviderId && !existingRoles.has(`${dataProviderId}_data_provider`)) {
            const roleId = uuidv4();
            rolesToAdd.push({
                roleId,
                projectId,
                userId: dataProviderId,
                roleType: 'data_provider',
                assignedBy: ownerId
            });
            rolesAdded.push('data_provider');

            // Add notification for data provider
            const notificationId = uuidv4(); // Generate a notification ID
            await client.query(
                'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                [
                    notificationId, // Add the notification ID
                    dataProviderId,
                    `You have been assigned as data provider for project ${projectId}`,
                    false,
                    projectId
                ]
            );
        }

        // Check and add collaborator role if provided and doesn't exist
        if (collaboratorId && !existingRoles.has(`${collaboratorId}_collaborator`)) {
            const roleId = uuidv4();
            rolesToAdd.push({
                roleId,
                projectId,
                userId: collaboratorId,
                roleType: 'collaborator',
                assignedBy: ownerId
            });
            rolesAdded.push('collaborator');

            // Add notification for collaborator
            const notificationId = uuidv4(); // Generate a notification ID
            await client.query(
                'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                [
                    notificationId, // Add the notification ID
                    collaboratorId,
                    `You have been assigned as collaborator for project ${projectId}`,
                    false,
                    projectId
                ]
            );
        }

        // Insert all new roles in one batch if there are any
        if (rolesToAdd.length > 0) {
            const insertQuery = 'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)';

            for (const role of rolesToAdd) {
                await client.query(insertQuery, [
                    role.roleId,
                    role.projectId,
                    role.userId,
                    role.roleType,
                    role.assignedBy
                ]);
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Roles assigned successfully',
            rolesAdded
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error assigning roles:', error);
        res.status(500).json({ error: 'Failed to assign roles' });
    } finally {
        client.release();
    }
}

/**
 * Delete a role assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteRole(req, res) {
    try {
        const { roleId } = req.params;

        // Check if the role exists first
        const roleCheckResult = await pool.query(
            'SELECT role_id FROM roles WHERE role_id = $1',
            [roleId]
        );

        if (roleCheckResult.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // Delete the role
        await pool.query(
            'DELETE FROM roles WHERE role_id = $1',
            [roleId]
        );

        res.json({ message: 'Role removed successfully' });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
}

/**
 * Add a new role to an existing project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function addRoleToProject(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { projectId, userId, roleType, assignedBy } = req.body;

        if (!projectId || !userId || !roleType || !assignedBy) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if the project exists
        const projectResult = await client.query(
            'SELECT project_id FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user already has a role in this project
        const roleCheckResult = await client.query(
            'SELECT role_id FROM roles WHERE project_id = $1 AND user_id = $2',
            [projectId, userId]
        );

        if (roleCheckResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'User already has a role in this project' });
        }

        // Create the new role
        const roleId = uuidv4();

        await client.query(
            'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
            [roleId, projectId, userId, roleType, assignedBy]
        );

        // Get project name for notification message
        const projectNameResult = await client.query(
            'SELECT project_name FROM projects WHERE project_id = $1',
            [projectId]
        );

        const projectName = projectNameResult.rows.length > 0
            ? projectNameResult.rows[0].project_name
            : `Project ${projectId}`;

        // Create notification for the user
        const notificationId = uuidv4(); // Generate a notification ID
        await client.query(
            'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
            [
                notificationId, // Add the notification ID
                userId,
                `You have been assigned as ${roleType.replace('_', ' ')} for project "${projectName}"`,
                false,
                projectId
            ]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Role assigned successfully',
            roleId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    } finally {
        client.release();
    }
}

module.exports = {
    createRoles,
    deleteRole,
    addRoleToProject
};