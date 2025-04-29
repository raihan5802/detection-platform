const { Project, User, Role, Notification, DataAccess } = require('../models');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

/**
 * Create a new project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createProject = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            userId,
            projectName,
            folderId,
            projectType,
            labelClasses,
            dataProviderEmails = [],
            collaboratorEmails = [],
            hasData = true
        } = req.body;

        // Create new project
        const projectId = uuidv4();
        const folderPath = path.join('uploads', folderId);
        const createdAt = new Date().toISOString();

        const project = await Project.create({
            project_id: projectId,
            user_id: userId,
            project_name: projectName,
            project_type: projectType,
            label_classes: labelClasses,
            folder_path: folderPath,
            created_at: createdAt,
            has_data: hasData
        }, { transaction });

        // Create owner role
        await Role.create({
            role_id: uuidv4(),
            project_id: projectId,
            user_id: userId,
            role_type: 'project_owner',
            assigned_by: 'system',
            assigned_at: createdAt
        }, { transaction });

        // Set to keep track of processed users
        const processedUsers = new Set();

        // Process data providers
        if (dataProviderEmails.length > 0) {
            const dataProviders = await User.findAll({
                where: {
                    email: {
                        [Op.in]: dataProviderEmails
                    }
                }
            }, { transaction });

            for (const provider of dataProviders) {
                // Skip if already processed
                const userKey = `${projectId}-${provider.id}`;
                if (processedUsers.has(userKey)) continue;

                processedUsers.add(userKey);

                // Create role
                await Role.create({
                    role_id: uuidv4(),
                    project_id: projectId,
                    user_id: provider.id,
                    role_type: 'data_provider',
                    assigned_by: userId,
                    assigned_at: createdAt
                }, { transaction });

                // Create notification
                await Notification.create({
                    notification_id: uuidv4(),
                    user_id: provider.id,
                    message: `You have been assigned as data provider for project "${projectName}"`,
                    is_read: false,
                    related_project_id: projectId,
                    created_at: createdAt
                }, { transaction });
            }
        }

        // Process collaborators
        if (collaboratorEmails.length > 0) {
            const collaborators = await User.findAll({
                where: {
                    email: {
                        [Op.in]: collaboratorEmails
                    }
                }
            }, { transaction });

            for (const collaborator of collaborators) {
                // Skip if already processed
                const userKey = `${projectId}-${collaborator.id}`;
                if (processedUsers.has(userKey)) continue;

                processedUsers.add(userKey);

                // Create role
                await Role.create({
                    role_id: uuidv4(),
                    project_id: projectId,
                    user_id: collaborator.id,
                    role_type: 'collaborator',
                    assigned_by: userId,
                    assigned_at: createdAt
                }, { transaction });

                // Create notification
                await Notification.create({
                    notification_id: uuidv4(),
                    user_id: collaborator.id,
                    message: `You have been assigned as collaborator for project "${projectName}"`,
                    is_read: false,
                    related_project_id: projectId,
                    created_at: createdAt
                }, { transaction });
            }
        }

        await transaction.commit();

        res.json({
            projectId,
            message: 'Project created successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

/**
 * Get all projects or filter by userId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjects = async (req, res) => {
    try {
        const userId = req.query.userId;

        let whereClause = {};
        if (userId) {
            whereClause.user_id = userId;
        }

        const projects = await Project.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    attributes: ['username']
                }
            ]
        });

        // Map projects to add thumbnails
        const projectsWithThumbnails = await Promise.all(projects.map(async project => {
            const projectObj = project.toJSON();

            // Find thumbnail image for the project
            const projectDir = path.join(__dirname, '../../', projectObj.folder_path);

            // Function to find the first image in a directory (recursive)
            const findFirstImage = (dir) => {
                if (!fs.existsSync(dir)) return null;

                const items = fs.readdirSync(dir);

                // Check for user folders first
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        // Check if this is a user folder (contains username and date)
                        if (item.includes('_20')) {
                            // Look for image in user folders first
                            const userFolderImage = findFirstImageInFolder(fullPath);
                            if (userFolderImage) {
                                return path.join(item, userFolderImage).replace(/\\/g, '/');
                            }
                        }
                    }
                }

                // If no user folders or no images in user folders, search directly
                return findFirstImageInFolder(dir);
            };

            // Helper function to find first image in a specific folder
            const findFirstImageInFolder = (dir) => {
                if (!fs.existsSync(dir)) return null;

                const items = fs.readdirSync(dir);

                // First check for image files directly in this directory
                const imageFile = items.find(item => {
                    const fullPath = path.join(dir, item);
                    const isFile = fs.statSync(fullPath).isFile();
                    const ext = path.extname(item).toLowerCase();
                    return isFile && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
                });

                if (imageFile) {
                    return path.relative(dir, path.join(dir, imageFile))
                        .replace(/\\/g, '/'); // Normalize path separators
                }

                // If no image found, recursively search subdirectories
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        const found = findFirstImageInFolder(fullPath);
                        if (found) return path.join(item, found).replace(/\\/g, '/');
                    }
                }

                return null;
            };

            const relativePath = findFirstImage(projectDir);
            if (relativePath) {
                projectObj.thumbnailImage = `http://localhost:4000/${projectObj.folder_path}/${relativePath}`;
            }

            return projectObj;
        }));

        res.json(projectsWithThumbnails);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

/**
 * Get project by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectById = async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
};

/**
 * Update project labels
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateProjectLabels = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { labelClasses } = req.body;

        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Update label classes
        project.label_classes = labelClasses;
        await project.save();

        res.json({ message: 'Project labels updated successfully' });
    } catch (error) {
        console.error('Error updating project labels:', error);
        res.status(500).json({ error: 'Failed to update project labels' });
    }
};

/**
 * Update project data status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDataStatus = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { hasData } = req.body;

        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Update has_data field
        project.has_data = hasData;
        await project.save();

        res.json({ message: 'Project data status updated successfully' });
    } catch (error) {
        console.error('Error updating project data status:', error);
        res.status(500).json({ error: 'Failed to update project data status' });
    }
};

/**
 * Get folder structure recursively for a given folderId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFolderStructure = (req, res) => {
    const folderId = decodeURIComponent(req.params.folderId);
    const basePath = path.join(__dirname, '../../uploads', folderId);

    function readDirRecursive(dir) {
        if (!fs.existsSync(dir)) {
            return [];
        }

        const items = fs.readdirSync(dir);
        return items.map(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                return {
                    name: item,
                    type: 'folder',
                    children: readDirRecursive(fullPath)
                };
            } else {
                return {
                    name: item,
                    type: 'file'
                };
            }
        });
    }

    if (!fs.existsSync(basePath)) {
        return res.status(404).json({ error: 'Folder not found' });
    }

    const tree = {
        name: path.basename(basePath),
        type: 'folder',
        children: readDirRecursive(basePath)
    };

    res.json(tree);
};

/**
 * Get count of files in a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectFileCount = async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = project.folder_path;

        // Function to count files recursively
        const countFiles = (dir) => {
            if (!fs.existsSync(dir)) return 0;

            let count = 0;
            const items = fs.readdirSync(dir);

            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isFile()) {
                    // Only count files with supported extensions
                    const ext = path.extname(item).toLowerCase();
                    const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
                        '.mp4', '.avi', '.mov', '.mkv', '.webm',
                        '.txt', '.doc', '.docx', '.pdf',
                        '.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
                    if (supportedExts.includes(ext)) {
                        count++;
                    }
                } else if (stat.isDirectory()) {
                    count += countFiles(fullPath);
                }
            });

            return count;
        };

        const fileCount = countFiles(path.join(__dirname, '../../', folderPath));

        res.json({ fileCount });
    } catch (error) {
        console.error('Error counting project files:', error);
        res.status(500).json({ error: 'Failed to count project files' });
    }
};

/**
 * Get all files in a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProjectFiles = async (req, res) => {
    try {
        const { projectId } = req.params;
        const includePaths = req.query.includePaths === 'true';

        const project = await Project.findByPk(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectPath = project.folder_path;
        const parts = projectPath.split('/');
        const folderId = parts[1];

        const projectDir = path.join(__dirname, '../../uploads', folderId);

        if (!fs.existsSync(projectDir)) {
            return res.json({ files: [] });
        }

        // Get list of disabled user folders
        const disabledFolders = [];

        // Check data_access table for disabled folders
        const disabledAccess = await DataAccess.findAll({
            where: {
                project_id: projectId,
                is_enabled: false
            }
        });

        disabledAccess.forEach(access => {
            disabledFolders.push(access.user_folder);
        });

        // Also check for .access_disabled marker files
        const items = fs.readdirSync(projectDir);
        items.forEach(item => {
            const fullPath = path.join(projectDir, item);
            if (fs.statSync(fullPath).isDirectory() && item.includes('_20')) {
                const accessFlagPath = path.join(fullPath, '.access_disabled');
                if (fs.existsSync(accessFlagPath) && !disabledFolders.includes(item)) {
                    disabledFolders.push(item);
                }
            }
        });

        // Function to gather all files (excluding those in disabled folders)
        const getAllFiles = (dir, basePath = '') => {
            let results = [];

            if (!fs.existsSync(dir)) {
                return results;
            }

            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relativePath = path.join(basePath, item);

                // Skip hidden files
                if (item.startsWith('.')) {
                    continue;
                }

                if (fs.statSync(fullPath).isDirectory()) {
                    // Check if this is a user folder (username_YYYYMMDD)
                    if (item.includes('_20') && disabledFolders.includes(item)) {
                        // Skip this folder and all its contents if it's disabled
                        continue;
                    }

                    // Recursively process subfolders
                    results = results.concat(getAllFiles(fullPath, relativePath));
                } else {
                    // Only add files with supported extensions
                    const ext = path.extname(item).toLowerCase();
                    const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
                        '.mp4', '.avi', '.mov', '.mkv', '.webm',
                        '.txt', '.doc', '.docx', '.pdf',
                        '.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];

                    if (supportedExts.includes(ext)) {
                        if (includePaths) {
                            results.push({
                                path: relativePath,
                                url: `http://localhost:4000/${projectPath}/${relativePath}`
                            });
                        } else {
                            results.push(`http://localhost:4000/${projectPath}/${relativePath}`);
                        }
                    }
                }
            }

            return results;
        };

        const files = getAllFiles(projectDir);

        res.json({ files, count: files.length });
    } catch (error) {
        console.error('Error fetching project files:', error);
        res.status(500).json({ error: 'Failed to fetch project files' });
    }
};