const { User } = require('../models');

/**
 * Authentication middleware to verify user is logged in
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.authenticate = async (req, res, next) => {
    try {
        // Get userId from headers or request body
        const userId = req.headers.userId || req.body.userId || (req.query && req.query.userId);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Find user in database
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Attach user to request object
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
exports.authorize = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get projectId from request params or body
            const projectId = req.params.projectId || req.body.projectId;

            if (!projectId) {
                return res.status(400).json({ error: 'Project ID is required for authorization' });
            }

            // Find user's role for this project
            const { Role } = require('../models');
            const role = await Role.findOne({
                where: {
                    project_id: projectId,
                    user_id: req.user.id
                }
            });

            if (!role || !allowedRoles.includes(role.role_type)) {
                return res.status(403).json({ error: 'You do not have permission to perform this action' });
            }

            // Attach role to request object
            req.userRole = role.role_type;

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ error: 'Authorization failed' });
        }
    };
};

/**
 * Task access authorization middleware
 * @param {Array} allowedLevels - Array of allowed access levels ('editor', 'viewer')
 * @returns {Function} Middleware function
 */
exports.authorizeTaskAccess = (allowedLevels) => {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get taskId from request params or body
            const taskId = req.params.taskId || req.body.taskId;

            if (!taskId) {
                return res.status(400).json({ error: 'Task ID is required for authorization' });
            }

            // Check if user is the task creator
            const { Task, TaskAccess } = require('../models');
            const task = await Task.findOne({
                where: {
                    task_id: taskId,
                    user_id: req.user.id
                }
            });

            if (task) {
                // Task creator always has 'editor' access
                req.userTaskAccess = 'editor';
                return next();
            }

            // Check task access level
            const taskAccess = await TaskAccess.findOne({
                where: {
                    task_id: taskId,
                    user_id: req.user.id
                }
            });

            if (!taskAccess || !allowedLevels.includes(taskAccess.access_level)) {
                return res.status(403).json({ error: 'You do not have permission to perform this action' });
            }

            // Attach access level to request object
            req.userTaskAccess = taskAccess.access_level;

            next();
        } catch (error) {
            console.error('Task access authorization error:', error);
            res.status(500).json({ error: 'Authorization failed' });
        }
    };
};