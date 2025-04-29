const { Task, User, Project, TaskAccess, Notification } = require('../models');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

/**
 * Create a new task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createTask = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { userId, projectId, taskName, projectName, annotationType, selectedFolders, teamAccess } = req.body;

        // Validate required fields
        if (!userId || !projectId || !taskName || !projectName || !annotationType || !selectedFolders) {
            await transaction.rollback();
            return res.status(400).json({ error: "All fields are required" });
        }

        // Extract only the folder paths that were checked
        const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
        if (selectedFolderPaths.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ error: "At least one folder must be selected" });
        }

        const taskId = uuidv4();
        const createdAt = new Date().toISOString();

        // Create task
        await Task.create({
            task_id: taskId,
            user_id: userId,
            project_id: projectId,
            task_name: taskName,
            project_name: projectName,
            annotation_type: annotationType,
            selected_files: selectedFolderPaths.join(';'),
            created_at: createdAt
        }, { transaction });

        // Default access for task creator
        await TaskAccess.create({
            task_id: taskId,
            user_id: userId,
            access_level: 'editor',
            assigned_by: userId,
            assigned_at: createdAt
        }, { transaction });

        // Process team access permissions if provided
        if (teamAccess && Object.keys(teamAccess).length > 0) {
            for (const [memberId, accessLevel] of Object.entries(teamAccess)) {
                if (memberId !== userId && accessLevel !== 'no_access') {
                    // Add task access
                    await TaskAccess.create({
                        task_id: taskId,
                        user_id: memberId,
                        access_level: accessLevel,
                        assigned_by: userId,
                        assigned_at: createdAt
                    }, { transaction });

                    // Create notification
                    const ownerUser = await User.findByPk(userId, { transaction });
                    const ownerUsername = ownerUser ? ownerUser.username : "A team member";

                    await Notification.create({
                        notification_id: uuidv4(),
                        user_id: memberId,
                        message: `${ownerUsername} gave you ${accessLevel} access to task "${taskName}"`,
                        is_read: false,
                        related_project_id: projectId,
                        created_at: createdAt
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        res.json({ taskId, message: "Task created successfully" });
    } catch (error) {
        await transaction.rollback();
        console.error("Error creating task:", error);
        res.status(500).json({ error: "Failed to create task" });
    }
};

/**
 * Get tasks for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTasks = async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // Get tasks created by this user
        const ownTasks = await Task.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Project,
                    attributes: ['project_id', 'project_name', 'project_type']
                }
            ]
        });

        // Get tasks where user has access
        const userAccess = await TaskAccess.findAll({
            where: {
                user_id: userId,
                access_level: {
                    [Op.ne]: 'no_access'
                }
            }
        });

        const accessTaskIds = userAccess.map(access => access.task_id);

        // Get tasks where user has access but is not the creator
        const otherTasks = accessTaskIds.length > 0 ?
            await Task.findAll({
                where: {
                    task_id: {
                        [Op.in]: accessTaskIds
                    },
                    user_id: {
                        [Op.ne]: userId
                    }
                },
                include: [
                    {
                        model: Project,
                        attributes: ['project_id', 'project_name', 'project_type']
                    }
                ]
            }) : [];

        // Combine and format tasks
        const allTasks = [...ownTasks, ...otherTasks].map(task => {
            const taskData = task.toJSON();

            // Add access level
            if (taskData.user_id === userId) {
                taskData.access_level = 'editor';
            } else {
                const accessRecord = userAccess.find(access => access.task_id === taskData.task_id);
                taskData.access_level = accessRecord ? accessRecord.access_level : 'no_access';
            }

            return taskData;
        });

        res.json(allTasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};

/**
 * Get task access level for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTaskAccess = async (req, res) => {
    try {
        const { taskId, userId } = req.params;

        // Check if user is the task creator
        const task = await Task.findOne({
            where: {
                task_id: taskId,
                user_id: userId
            }
        });

        if (task) {
            return res.json({ access_level: 'editor' });
        }

        // Check task access
        const taskAccess = await TaskAccess.findOne({
            where: {
                task_id: taskId,
                user_id: userId
            }
        });

        if (taskAccess) {
            return res.json({ access_level: taskAccess.access_level });
        }

        // Default to no access
        res.json({ access_level: 'no_access' });
    } catch (error) {
        console.error('Error fetching task access:', error);
        res.status(500).json({ error: 'Failed to fetch task access' });
    }
};

/**
 * Bulk update task access levels
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.bulkUpdateTaskAccess = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { taskId } = req.params;
        const { accessLevels, assignedBy } = req.body;

        if (!taskId || !assignedBy || !accessLevels || typeof accessLevels !== 'object') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify the task exists
        const task = await Task.findByPk(taskId, { transaction });

        if (!task) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }

        // Verify user has permission to update access
        let hasPermission = false;

        if (task.user_id === assignedBy) {
            hasPermission = true;
        } else {
            const userAccess = await TaskAccess.findOne({
                where: {
                    task_id: taskId,
                    user_id: assignedBy,
                    access_level: 'editor'
                },
                transaction
            });

            hasPermission = !!userAccess;
        }

        if (!hasPermission) {
            await transaction.rollback();
            return res.status(403).json({ error: 'You do not have permission to update access levels' });
        }

        // Get original access levels to compare
        const originalAccess = {};
        const existingAccess = await TaskAccess.findAll({
            where: { task_id: taskId },
            transaction
        });

        existingAccess.forEach(access => {
            originalAccess[access.user_id] = access.access_level;
        });

        // Delete current access levels
        await TaskAccess.destroy({
            where: { task_id: taskId },
            transaction
        });

        // Add updated access levels
        const timestamp = new Date().toISOString();
        const userIdsToNotify = new Set();

        // Get assigner username
        const assignerUser = await User.findByPk(assignedBy, {
            attributes: ['username'],
            transaction
        });
        const assignerUsername = assignerUser ? assignerUser.username : "A team member";

        for (const [userId, accessLevel] of Object.entries(accessLevels)) {
            if (['editor', 'viewer', 'no_access'].includes(accessLevel)) {
                await TaskAccess.create({
                    task_id: taskId,
                    user_id: userId,
                    access_level: accessLevel,
                    assigned_by: assignedBy,
                    assigned_at: timestamp
                }, { transaction });

                // Check if access has changed and create notification
                const oldAccessLevel = originalAccess[userId] || 'no_access';

                if (accessLevel !== oldAccessLevel && accessLevel !== 'no_access') {
                    userIdsToNotify.add(userId);

                    await Notification.create({
                        notification_id: uuidv4(),
                        user_id: userId,
                        message: `${assignerUsername} gave you ${accessLevel} access to task "${task.task_name}"`,
                        is_read: false,
                        related_project_id: task.project_id,
                        created_at: timestamp
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        res.json({
            message: 'Access levels updated successfully',
            updatedCount: Object.keys(accessLevels).length,
            notifiedUsers: Array.from(userIdsToNotify)
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating task access levels:', error);
        res.status(500).json({ error: 'Failed to update access levels' });
    }
};

/**
 * Get project team members for task assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectTeam = async (req, res) => {
    try {
        const { projectId } = req.params;

        const projectRoles = await Role.findAll({
            where: { project_id: projectId },
            include: [
                {
                    model: User,
                    attributes: ['id', 'username', 'email']
                }
            ]
        });

        if (projectRoles.length === 0) {
            return res.json([]);
        }

        const teamMembers = projectRoles.map(role => ({
            user_id: role.User.id,
            username: role.User.username,
            email: role.User.email,
            role_type: role.role_type
        }));

        res.json(teamMembers);
    } catch (error) {
        console.error('Error fetching project team:', error);
        res.status(500).json({ error: 'Failed to fetch project team' });
    }
};

/**
 * Find first image in a folder for task card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFirstImage = (req, res) => {
    try {
        const folderPath = req.query.folderPath;
        if (!folderPath) return res.status(400).json({ error: 'folderPath required' });

        const basePath = path.join(__dirname, '../../uploads', folderPath);
        if (!fs.existsSync(basePath)) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

        function findFirstImage(dir) {
            const items = fs.readdirSync(dir);
            for (let item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    if (imageExtensions.includes(ext)) {
                        return item;
                    }
                } else if (stat.isDirectory()) {
                    const found = findFirstImage(fullPath);
                    if (found) return path.join(item, found);
                }
            }
            return null;
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
};