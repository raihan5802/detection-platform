module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProjectLabels,
    updateProjectDataStatus,
    getProjectTeam,
    getProjectRole,
    getUserProjects,
    getProjectMembers,
    addProjectMembers,
    getProjectFileCount,
    getProjectUserData,
    getProjectFiles,
    deleteProject
}; const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const fileUtils = require('../utils/fileUtils');

// Use explicit imports
const findFirstImage = fileUtils.findFirstImage;
const countFiles = fileUtils.countFiles;
const getAllFilesWithAccessControl = fileUtils.getAllFilesWithAccessControl;
const deleteFolderRecursive = fileUtils.deleteFolderRecursive;

/**
 * Create a new project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createProject(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            userId,
            projectName,
            folderId,
            projectType,
            labelClasses,
            dataProviderEmails = [], // Default to empty array
            collaboratorEmails = [], // Default to empty array
            hasData = true
        } = req.body;

        // Validate required fields
        if (!userId || !projectName || !folderId || !projectType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const folderPath = path.join('uploads', folderId);
        const escapedLabelClasses = JSON.stringify(labelClasses);

        // Generate a UUID for the project
        const projectId = uuidv4();

        // Insert the project with the UUID
        await client.query(
            'INSERT INTO projects (project_id, user_id, project_name, project_type, label_classes, folder_path, has_data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [projectId, userId, projectName, projectType, escapedLabelClasses, folderPath, hasData]
        );

        // Create owner role
        await client.query(
            'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), projectId, userId, 'project_owner', 'system']
        );

        // Add data providers
        if (dataProviderEmails && dataProviderEmails.length > 0) {
            // Get user IDs for emails
            const dataProviderUserIds = await Promise.all(
                dataProviderEmails.map(async (email) => {
                    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
                    return userResult.rows.length > 0 ? userResult.rows[0].id : null;
                })
            );

            // Filter out null values and create roles
            const validDataProviderIds = dataProviderUserIds.filter(id => id !== null);

            for (const dataProviderId of validDataProviderIds) {
                // Check if user already has a role in this project
                const roleCheck = await client.query(
                    'SELECT * FROM roles WHERE project_id = $1 AND user_id = $2',
                    [projectId, dataProviderId]
                );

                if (roleCheck.rows.length === 0) {
                    // Insert role
                    await client.query(
                        'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), projectId, dataProviderId, 'data_provider', userId]
                    );

                    // Create notification
                    await client.query(
                        'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), dataProviderId, `You have been assigned as data provider for project "${projectName}"`, false, projectId]
                    );
                }
            }
        }

        // Add collaborators
        if (collaboratorEmails && collaboratorEmails.length > 0) {
            // Get user IDs for emails
            const collaboratorUserIds = await Promise.all(
                collaboratorEmails.map(async (email) => {
                    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
                    return userResult.rows.length > 0 ? userResult.rows[0].id : null;
                })
            );

            // Filter out null values and create roles
            const validCollaboratorIds = collaboratorUserIds.filter(id => id !== null);

            for (const collaboratorId of validCollaboratorIds) {
                // Check if user already has a role in this project
                const roleCheck = await client.query(
                    'SELECT * FROM roles WHERE project_id = $1 AND user_id = $2',
                    [projectId, collaboratorId]
                );

                if (roleCheck.rows.length === 0) {
                    // Insert role
                    await client.query(
                        'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), projectId, collaboratorId, 'collaborator', userId]
                    );

                    // Create notification
                    await client.query(
                        'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), collaboratorId, `You have been assigned as collaborator for project "${projectName}"`, false, projectId]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            projectId,
            message: 'Project created successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    } finally {
        client.release();
    }
}

/**
 * Get all projects, optionally filtered by user ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjects(req, res) {
    try {
        // Get userId from query
        const userId = req.query.userId;

        let query = 'SELECT * FROM projects';
        let params = [];

        // Filter by userId if provided
        if (userId) {
            query += ' WHERE user_id = $1';
            params.push(userId);
        }

        const result = await pool.query(query, params);

        // Process the results
        const projects = result.rows.map(project => {
            // Convert label_classes appropriately based on its type
            let parsedLabelClasses;
            if (typeof project.label_classes === 'string') {
                // If it's a string, parse it as JSON
                parsedLabelClasses = JSON.parse(project.label_classes);
            } else if (project.label_classes && typeof project.label_classes === 'object') {
                // If it's already an object (JSONB type in PostgreSQL), use it directly
                parsedLabelClasses = project.label_classes;
            } else {
                // Default to empty array
                parsedLabelClasses = [];
            }

            return {
                project_id: project.project_id,
                user_id: project.user_id,
                project_name: project.project_name,
                project_type: project.project_type,
                label_classes: parsedLabelClasses,
                folder_path: project.folder_path,
                created_at: project.created_at,
                hasData: project.has_data
            };
        });

        // Find thumbnail image for each project
        projects.forEach(proj => {
            const projectDir = path.join(__dirname, '..', '..', proj.folder_path);
            const relativePath = findFirstImage(projectDir);
            if (relativePath) {
                proj.thumbnailImage = `http://localhost:4000/${proj.folder_path}/${relativePath}`;
            }
        });

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
}

/**
 * Get a specific project by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectById(req, res) {
    try {
        const { projectId } = req.params;

        const result = await pool.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const project = result.rows[0];

        // Convert label_classes appropriately based on its type
        let parsedLabelClasses;
        if (typeof project.label_classes === 'string') {
            // If it's a string, parse it as JSON
            parsedLabelClasses = JSON.parse(project.label_classes);
        } else if (project.label_classes && typeof project.label_classes === 'object') {
            // If it's already an object (JSONB type in PostgreSQL), use it directly
            parsedLabelClasses = project.label_classes;
        } else {
            // Default to empty array
            parsedLabelClasses = [];
        }

        res.json({
            project_id: project.project_id,
            user_id: project.user_id,
            project_name: project.project_name,
            project_type: project.project_type,
            label_classes: parsedLabelClasses,
            folder_path: project.folder_path,
            created_at: project.created_at,
            hasData: project.has_data
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
}

/**
 * Update project labels
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateProjectLabels(req, res) {
    try {
        const { projectId } = req.params;
        const { labelClasses } = req.body; // expecting an array of label objects: {name, color}

        if (!Array.isArray(labelClasses)) {
            return res.status(400).json({ error: 'labelClasses must be an array' });
        }

        // Convert to JSON string
        const labelClassesJson = JSON.stringify(labelClasses);

        // Update the project
        const result = await pool.query(
            'UPDATE projects SET label_classes = $1 WHERE project_id = $2 RETURNING *',
            [labelClassesJson, projectId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project labels updated successfully' });
    } catch (error) {
        console.error('Error updating project labels:', error);
        res.status(500).json({ error: 'Failed to update project labels' });
    }
}

/**
 * Update project data status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateProjectDataStatus(req, res) {
    try {
        const { projectId } = req.params;
        const { hasData } = req.body;

        if (typeof hasData !== 'boolean') {
            return res.status(400).json({ error: 'hasData must be a boolean' });
        }

        // Update the project
        const result = await pool.query(
            'UPDATE projects SET has_data = $1 WHERE project_id = $2 RETURNING *',
            [hasData, projectId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project data status updated successfully' });
    } catch (error) {
        console.error('Error updating project data status:', error);
        res.status(500).json({ error: 'Failed to update project data status' });
    }
}

/**
 * Get project team members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectTeam(req, res) {
    try {
        const { projectId } = req.params;

        // Join roles and users tables to get team members
        const query = `
            SELECT u.id as user_id, u.username, u.email, r.role_type
            FROM roles r
            JOIN users u ON r.user_id = u.id
            WHERE r.project_id = $1
        `;

        const result = await pool.query(query, [projectId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching project team:', error);
        res.status(500).json({ error: 'Failed to fetch project team' });
    }
}

/**
 * Get user's role for a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectRole(req, res) {
    try {
        const { projectId, userId } = req.params;

        const result = await pool.query(
            'SELECT role_type FROM roles WHERE project_id = $1 AND user_id = $2',
            [projectId, userId]
        );

        if (result.rows.length === 0) {
            return res.json({ role: null });
        }

        res.json({ role: result.rows[0].role_type });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
}

/**
 * Get all projects a user has access to
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserProjects(req, res) {
    try {
        const { userId } = req.params;

        // Get all projects and roles for this user
        const query = `
            SELECT p.*, r.role_type
            FROM projects p
            JOIN roles r ON p.project_id = r.project_id
            WHERE r.user_id = $1
        `;

        const result = await pool.query(query, [userId]);

        // Transform into expected format
        const projectsMap = {};
        const rolesMap = {};

        result.rows.forEach(row => {
            // Process project data
            const project = {
                project_id: row.project_id,
                user_id: row.user_id,
                project_name: row.project_name,
                project_type: row.project_type,
                label_classes: typeof row.label_classes === 'string'
                    ? JSON.parse(row.label_classes)
                    : row.label_classes,
                folder_path: row.folder_path,
                created_at: row.created_at,
                hasData: row.has_data
            };

            // Store in maps
            projectsMap[row.project_id] = project;
            rolesMap[row.project_id] = row.role_type;
        });

        // Convert to arrays
        const projects = Object.values(projectsMap);

        // Find thumbnail images
        projects.forEach(proj => {
            const projectDir = path.join(__dirname, '..', '..', proj.folder_path);
            const relativePath = findFirstImage(projectDir);
            if (relativePath) {
                proj.thumbnailImage = `http://localhost:4000/${proj.folder_path}/${relativePath}`;
            }
        });

        res.json({
            projects: projects,
            roles: rolesMap
        });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ error: 'Failed to fetch user projects' });
    }
}

/**
 * Get project members (excluding owner)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectMembers(req, res) {
    try {
        const { projectId } = req.params;

        // Query for project members excluding owner
        const query = `
            SELECT u.id as user_id, u.username, u.email, r.role_type
            FROM roles r
            JOIN users u ON r.user_id = u.id
            WHERE r.project_id = $1 AND r.role_type != 'project_owner'
        `;

        const result = await pool.query(query, [projectId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching project members:', error);
        res.status(500).json({ error: 'Failed to fetch project members' });
    }
}

/**
 * Add project members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function addProjectMembers(req, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            projectId,
            projectName,
            ownerId,
            dataProviderEmails = [],
            collaboratorEmails = []
        } = req.body;

        if (!projectId || !ownerId) {
            return res.status(400).json({ error: 'Project ID and owner ID are required' });
        }

        let addedCount = 0;

        // Process data providers
        if (dataProviderEmails && dataProviderEmails.length > 0) {
            for (const email of dataProviderEmails) {
                // Find user ID for email
                const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);

                if (userResult.rows.length > 0) {
                    const userId = userResult.rows[0].id;

                    // Check if user already has a role in this project
                    const roleCheck = await client.query(
                        'SELECT * FROM roles WHERE project_id = $1 AND user_id = $2',
                        [projectId, userId]
                    );

                    if (roleCheck.rows.length === 0) {
                        // Insert role
                        await client.query(
                            'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), projectId, userId, 'data_provider', ownerId]
                        );

                        // Create notification
                        await client.query(
                            'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), userId, `You have been assigned as data provider for project "${projectName}"`, false, projectId]
                        );

                        addedCount++;
                    }
                }
            }
        }

        // Process collaborators
        if (collaboratorEmails && collaboratorEmails.length > 0) {
            for (const email of collaboratorEmails) {
                // Find user ID for email
                const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);

                if (userResult.rows.length > 0) {
                    const userId = userResult.rows[0].id;

                    // Check if user already has a role in this project
                    const roleCheck = await client.query(
                        'SELECT * FROM roles WHERE project_id = $1 AND user_id = $2',
                        [projectId, userId]
                    );

                    if (roleCheck.rows.length === 0) {
                        // Insert role
                        await client.query(
                            'INSERT INTO roles (role_id, project_id, user_id, role_type, assigned_by) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), projectId, userId, 'collaborator', ownerId]
                        );

                        // Create notification
                        await client.query(
                            'INSERT INTO notifications (notification_id, user_id, message, is_read, related_project_id) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), userId, `You have been assigned as collaborator for project "${projectName}"`, false, projectId]
                        );

                        addedCount++;
                    }
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Team members added successfully',
            addedCount
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding team members:', error);
        res.status(500).json({ error: 'Failed to add team members' });
    } finally {
        client.release();
    }
}

/**
 * Get count of files in a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectFileCount(req, res) {
    try {
        const { projectId } = req.params;

        // Get folder path from database
        const result = await pool.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = result.rows[0].folder_path;
        const fileCount = countFiles(path.join(__dirname, '..', '..', folderPath));

        res.json({ fileCount });
    } catch (error) {
        console.error('Error counting project files:', error);
        res.status(500).json({ error: 'Failed to count project files' });
    }
}

/**
 * Get user data folders for a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectUserData(req, res) {
    try {
        const { projectId } = req.params;
        const userId = req.query.userId; // Optional user ID to filter by

        // Get the folder ID from the project record
        const projectResult = await pool.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = projectResult.rows[0].folder_path;
        const folderId = folderPath.split('/')[1]; // Extract folder ID from path

        if (!folderId) {
            return res.status(404).json({ error: 'Project folder not found' });
        }

        const projectDir = path.join(__dirname, '..', '..', 'uploads', folderId);

        if (!fs.existsSync(projectDir)) {
            return res.json([]);
        }

        // Read the folder to find user subfolders
        const items = fs.readdirSync(projectDir);

        // Get username for the requesting user if filtering is needed
        let requestingUsername = null;
        if (userId) {
            const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) {
                requestingUsername = userResult.rows[0].username.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder matching
            }
        }

        let userFolders = items.filter(item => {
            const fullPath = path.join(projectDir, item);
            const isUserFolder = fs.statSync(fullPath).isDirectory() && item.includes('_'); // Match pattern username_YYYYMMDD

            // If userId is provided (for data providers), only return their own folders
            if (userId && requestingUsername) {
                // Check if this folder belongs to the requesting user
                return isUserFolder && item.startsWith(requestingUsername + '_');
            }

            return isUserFolder;
        });

        // Get access status for each folder
        const accessStatuses = {};
        const accessResult = await pool.query(
            'SELECT user_folder, is_enabled FROM data_access WHERE project_id = $1',
            [projectId]
        );

        accessResult.rows.forEach(row => {
            accessStatuses[row.user_folder] = row.is_enabled;
        });

        // Create the response with user information
        const userFolderInfo = userFolders.map(folderName => {
            const parts = folderName.split('_');
            const username = parts[0];
            const uploadDate = parts.length > 1 ? parts[1] : null;

            // Count files
            let fileCount = 0;
            function countDirFiles(dir) {
                if (!fs.existsSync(dir)) return 0;
                const dirItems = fs.readdirSync(dir);
                dirItems.forEach(item => {
                    const itemPath = path.join(dir, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        fileCount += countDirFiles(itemPath);
                    } else if (fs.statSync(itemPath).isFile() && !item.startsWith('.')) {
                        fileCount++;
                    }
                });
                return fileCount;
            }

            countDirFiles(path.join(projectDir, folderName));

            return {
                folderName,
                username,
                uploadDate: uploadDate ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}` : null,
                isEnabled: accessStatuses[folderName] !== undefined ? accessStatuses[folderName] : true,
                fileCount
            };
        });

        res.json(userFolderInfo);
    } catch (error) {
        console.error('Error fetching project user data:', error);
        res.status(500).json({ error: 'Failed to fetch project user data' });
    }
}

/**
 * Get all files in a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProjectFiles(req, res) {
    try {
        const { projectId } = req.params;
        const includePaths = req.query.includePaths === 'true'; // Optional: include full path info

        // Get the folder ID from the project record
        const projectResult = await pool.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = projectResult.rows[0].folder_path;
        const folderId = folderPath.split('/')[1]; // Extract folder ID from path

        if (!folderId) {
            return res.status(404).json({ error: 'Project folder not found' });
        }

        const projectDir = path.join(__dirname, '..', '..', 'uploads', folderId);

        if (!fs.existsSync(projectDir)) {
            return res.json({ files: [] });
        }

        // Get list of disabled user folders from database
        const disabledFolders = [];

        const accessResult = await pool.query(
            'SELECT user_folder FROM data_access WHERE project_id = $1 AND is_enabled = false',
            [projectId]
        );

        accessResult.rows.forEach(row => {
            disabledFolders.push(row.user_folder);
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

        const files = getAllFilesWithAccessControl(projectDir, disabledFolders, '', folderPath, includePaths, 4000);

        res.json({ files, count: files.length });
    } catch (error) {
        console.error('Error fetching project files:', error);
        res.status(500).json({ error: 'Failed to fetch project files' });
    }
}

/**
 * Delete a project and all associated data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteProject(req, res) {
    const client = await pool.connect();
    let folderId = null;
    let taskIds = [];

    try {
        await client.query('BEGIN');

        const { projectId } = req.params;
        const userId = req.query.userId;

        console.log(`Attempting to delete project ${projectId} by user ${userId}`);

        // 1. Check if project exists and verify ownership if userId is provided
        const projectQuery = userId
            ? 'SELECT * FROM projects WHERE project_id = $1 AND user_id = $2'
            : 'SELECT * FROM projects WHERE project_id = $1';

        const projectParams = userId ? [projectId, userId] : [projectId];
        const projectResult = await client.query(projectQuery, projectParams);

        if (projectResult.rows.length === 0) {
            if (userId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Only project owners can delete projects' });
            } else {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Project not found' });
            }
        }

        // Store folder ID for file deletion later
        const projectFolderPath = projectResult.rows[0].folder_path;
        folderId = projectFolderPath.split('/')[1]; // Extract folder ID
        console.log(`Found project, folderId: ${folderId}`);

        // 2. Find associated tasks for deletion
        const tasksResult = await client.query(
            'SELECT task_id FROM tasks WHERE project_id = $1',
            [projectId]
        );
        taskIds = tasksResult.rows.map(row => row.task_id);
        console.log(`Found ${taskIds.length} associated tasks`);

        // 3. Delete task access records for these tasks in one query if there are any tasks
        if (taskIds.length > 0) {
            console.log('Deleting task access records');
            await client.query(
                'DELETE FROM task_access WHERE task_id = ANY($1::varchar[])',
                [taskIds]
            );
        }

        // 4. Delete the tasks
        if (taskIds.length > 0) {
            console.log('Deleting tasks');
            await client.query(
                'DELETE FROM tasks WHERE project_id = $1',
                [projectId]
            );
        }

        // 5. Delete in the following order to respect foreign key constraints
        // Order: data_access → notifications → roles → projects

        // 5.1 Delete data access records for this project
        console.log('Deleting data access records');
        await client.query(
            'DELETE FROM data_access WHERE project_id = $1',
            [projectId]
        );

        // 5.2 Delete notifications related to this project
        console.log('Deleting related notifications');
        await client.query(
            'DELETE FROM notifications WHERE related_project_id = $1',
            [projectId]
        );

        // 5.3 Delete roles associated with this project
        console.log('Deleting role assignments');
        await client.query(
            'DELETE FROM roles WHERE project_id = $1',
            [projectId]
        );

        // 5.4 Finally delete the project record itself
        console.log('Deleting project record');
        await client.query(
            'DELETE FROM projects WHERE project_id = $1',
            [projectId]
        );

        // 6. Commit the transaction
        await client.query('COMMIT');
        console.log('Database transaction committed successfully');

        // 7. Delete project files (outside of transaction since it's filesystem operation)
        try {
            if (folderId) {
                console.log('Deleting project files');
                const folderPath = path.join(__dirname, '..', '..', 'uploads', folderId);
                if (fs.existsSync(folderPath)) {
                    deleteFolderRecursive(folderPath);
                }
            }
        } catch (fileError) {
            console.error('Error deleting project files:', fileError);
            // Continue even if file deletion fails - it can be cleaned up later
        }

        console.log('Project deletion completed successfully');
        res.json({
            message: 'Project deleted successfully',
            tasksDeleted: taskIds.length
        });
    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error in deleteProject:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    } finally {
        // Always release the client
        client.release();
    }
}