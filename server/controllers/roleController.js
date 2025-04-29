const { Role, User, Project, Notification } = require('../models');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

/**
 * Create role assignments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createRoles = async (req, res) => {
    try {
        const { projectId, ownerId, dataProviderId, collaboratorId } = req.body;
        const timestamp = new Date().toISOString();

        // Create owner role if it doesn't exist
        const existingOwnerRole = await Role.findOne({
            where: {
                project_id: projectId,
                user_id: ownerId,
                role_type: 'project_owner'
            }
        });

        if (!existingOwnerRole) {
            await Role.create({
                role_id: uuidv4(),
                project_id: projectId,
                user_id: ownerId,
                role_type: 'project_owner',
                assigned_by: 'system',
                assigned_at: timestamp
            });
        }

        // Create data provider role if provided
        if (dataProviderId) {
            const existingProviderRole = await Role.findOne({
                where: {
                    project_id: projectId,
                    user_id: dataProviderId,
                    role_type: 'data_provider'
                }
            });

            if (!existingProviderRole) {
                await Role.create({
                    role_id: uuidv4(),
                    project_id: projectId,
                    user_id: dataProviderId,
                    role_type: 'data_provider',
                    assigned_by: ownerId,
                    assigned_at: timestamp
                });
            }
        }

        // Create collaborator role if provided
        if (collaboratorId) {
            const existingCollaboratorRole = await Role.findOne({
                where: {
                    project_id: projectId,
                    user_id: collaboratorId,
                    role_type: 'collaborator'
                }
            });

            if (!existingCollaboratorRole) {
                await Role.create({
                    role_id: uuidv4(),
                    project_id: projectId,
                    user_id: collaboratorId,
                    role_type: 'collaborator',
                    assigned_by: ownerId,
                    assigned_at: timestamp
                });
            }
        }

        res.json({ message: 'Roles assigned successfully' });
    } catch (error) {
        console.error('Error assigning roles:', error);
        res.status(500).json({ error: 'Failed to assign roles' });
    }
};

/**
 * Get user's role for a specific project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectRole = async (req, res) => {
    try {
        const { projectId, userId } = req.params;

        const role = await Role.findOne({
            where: {
                project_id: projectId,
                user_id: userId
            }
        });

        res.json({ role: role ? role.role_type : null });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
};

/**
 * Get all projects a user has access to and their roles
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserProjects = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find all roles for this user
        const userRoles = await Role.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Project,
                    include: [
                        {
                            model: User,
                            attributes: ['username']
                        }
                    ]
                }
            ]
        });

        if (userRoles.length === 0) {
            return res.json({ projects: [], roles: {} });
        }

        // Create role map and project list
        const roles = {};
        const projects = userRoles.map(role => {
            const project = role.Project.toJSON();
            roles[project.project_id] = role.role_type;

            // Find thumbnail image for each project
            const projectDir = path.join(__dirname, '../../', project.folder_path);

            const findFirstImage = (dir) => {
                if (!fs.existsSync(dir)) return null;

                const items = fs.readdirSync(dir);

                const imageFile = items.find(item => {
                    const fullPath = path.join(dir, item);
                    const isFile = fs.statSync(fullPath).isFile();
                    const ext = path.extname(item).toLowerCase();
                    return isFile && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
                });

                if (imageFile) {
                    return path.relative(projectDir, path.join(dir, imageFile))
                        .replace(/\\/g, '/');
                }

                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        const found = findFirstImage(fullPath);
                        if (found) return found;
                    }
                }

                return null;
            };

            const relativePath = findFirstImage(projectDir);
            if (relativePath) {
                project.thumbnailImage = `http://localhost:4000/${project.folder_path}/${relativePath}`;
            }

            return project;
        });

        res.json({ projects, roles });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ error: 'Failed to fetch user projects' });
    }
};

/**
 * Get project team members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectMembers = async (req, res) => {
    try {
        const { projectId } = req.params;

        const projectRoles = await Role.findAll({
            where: {
                project_id: projectId,
                role_type: {
                    [Op.ne]: 'project_owner'
                }
            },
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
            role_type: role.role_type,
            username: role.User.username,
            email: role.User.email
        }));

        res.json(teamMembers);
    } catch (error) {
        console.error('Error fetching project members:', error);
        res.status(500).json({ error: 'Failed to fetch project members' });
    }
};

/**
 * Add team members to a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.addProjectMembers = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            projectId,
            projectName,
            ownerId,
            dataProviderEmails,
            collaboratorEmails
        } = req.body;

        if (!projectId || !ownerId) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Project ID and owner ID are required' });
        }

        const timestamp = new Date().toISOString();
        let addedCount = 0;

        // Set to track processed users to avoid duplicates
        const processedUsers = new Set();

        // Get existing roles
        const existingRoles = await Role.findAll({
            where: { project_id: projectId },
            transaction
        });

        // Add existing users to processed set
        existingRoles.forEach(role => {
            processedUsers.add(`${projectId}-${role.user_id}`);
        });

        // Process data providers
        if (dataProviderEmails && dataProviderEmails.length > 0) {
            for (const email of dataProviderEmails) {
                const user = await User.findOne({
                    where: { email },
                    transaction
                });

                if (user) {
                    // Check if already processed
                    const userKey = `${projectId}-${user.id}`;
                    if (processedUsers.has(userKey)) continue;

                    processedUsers.add(userKey);

                    // Create role
                    await Role.create({
                        role_id: uuidv4(),
                        project_id: projectId,
                        user_id: user.id,
                        role_type: 'data_provider',
                        assigned_by: ownerId,
                        assigned_at: timestamp
                    }, { transaction });

                    // Create notification
                    await Notification.create({
                        notification_id: uuidv4(),
                        user_id: user.id,
                        message: `You have been assigned as data provider for project "${projectName}"`,
                        is_read: false,
                        related_project_id: projectId,
                        created_at: timestamp
                    }, { transaction });

                    addedCount++;
                }
            }
        }

        // Process collaborators
        if (collaboratorEmails && collaboratorEmails.length > 0) {
            for (const email of collaboratorEmails) {
                const user = await User.findOne({
                    where: { email },
                    transaction
                });

                if (user) {
                    // Check if already processed
                    const userKey = `${projectId}-${user.id}`;
                    if (processedUsers.has(userKey)) continue;

                    processedUsers.add(userKey);

                    // Create role
                    await Role.create({
                        role_id: uuidv4(),
                        project_id: projectId,
                        user_id: user.id,
                        role_type: 'collaborator',
                        assigned_by: ownerId,
                        assigned_at: timestamp
                    }, { transaction });

                    // Create notification
                    await Notification.create({
                        notification_id: uuidv4(),
                        user_id: user.id,
                        message: `You have been assigned as collaborator for project "${projectName}"`,
                        is_read: false,
                        related_project_id: projectId,
                        created_at: timestamp
                    }, { transaction });

                    addedCount++;
                }
            }
        }

        await transaction.commit();

        res.json({
            message: 'Team members added successfully',
            addedCount
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error adding team members:', error);
        res.status(500).json({ error: 'Failed to add team members' });
    }
};

/**
 * Delete a role assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteRole = async (req, res) => {
    try {
        const { roleId } = req.params;

        const deleted = await Role.destroy({
            where: { role_id: roleId }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json({ message: 'Role removed successfully' });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
};

/**
 * Add a new role assignment to an existing project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.addRoleToProject = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { projectId, userId, roleType, assignedBy } = req.body;

        if (!projectId || !userId || !roleType || !assignedBy) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user already has a role in this project
        const existingRole = await Role.findOne({
            where: {
                project_id: projectId,
                user_id: userId
            },
            transaction
        });

        if (existingRole) {
            await transaction.rollback();
            return res.status(400).json({ error: 'User already has a role in this project' });
        }

        // Create new role
        const roleId = uuidv4();
        const timestamp = new Date().toISOString();

        await Role.create({
            role_id: roleId,
            project_id: projectId,
            user_id: userId,
            role_type: roleType,
            assigned_by: assignedBy,
            assigned_at: timestamp
        }, { transaction });

        // Get project name
        const project = await Project.findByPk(projectId, {
            attributes: ['project_name'],
            transaction
        });

        // Create notification
        await Notification.create({
            notification_id: uuidv4(),
            user_id: userId,
            message: `You have been assigned as ${roleType.replace('_', ' ')} for project "${project ? project.project_name : projectId}"`,
            is_read: false,
            related_project_id: projectId,
            created_at: timestamp
        }, { transaction });

        await transaction.commit();

        res.json({ message: 'Role assigned successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
};