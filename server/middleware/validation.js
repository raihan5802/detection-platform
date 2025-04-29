/**
 * Validate project creation request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateProjectCreate = (req, res, next) => {
    const { userId, projectName, folderId, projectType } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!projectName) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' });
    }

    if (!projectType) {
        return res.status(400).json({ error: 'Project type is required' });
    }

    next();
};

/**
 * Validate task creation request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateTaskCreate = (req, res, next) => {
    const { userId, projectId, taskName, projectName, annotationType, selectedFolders } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!taskName) {
        return res.status(400).json({ error: 'Task name is required' });
    }

    if (!projectName) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    if (!annotationType) {
        return res.status(400).json({ error: 'Annotation type is required' });
    }

    if (!selectedFolders || Object.keys(selectedFolders).length === 0) {
        return res.status(400).json({ error: 'At least one folder must be selected' });
    }

    next();
};

/**
 * Validate user sign up request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateSignUp = (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    next();
};

/**
 * Validate user sign in request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateSignIn = (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    next();
};

/**
 * Validate annotation save request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateAnnotationSave = (req, res, next) => {
    const { folderId, taskId, annotations } = req.body;

    if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' });
    }

    if (!taskId) {
        return res.status(400).json({ error: 'Task ID is required' });
    }

    if (!annotations) {
        return res.status(400).json({ error: 'Annotations are required' });
    }

    next();
};

/**
 * Validate role assignment request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateRoleAssignment = (req, res, next) => {
    const { projectId, userId, roleType, assignedBy } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!roleType) {
        return res.status(400).json({ error: 'Role type is required' });
    }

    // Validate role type
    const validRoleTypes = ['project_owner', 'data_provider', 'collaborator'];
    if (!validRoleTypes.includes(roleType)) {
        return res.status(400).json({ error: 'Invalid role type' });
    }

    if (!assignedBy) {
        return res.status(400).json({ error: 'Assigned by is required' });
    }

    next();
};

/**
 * Validate task access update request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateTaskAccessUpdate = (req, res, next) => {
    const { accessLevels, assignedBy } = req.body;

    if (!accessLevels || typeof accessLevels !== 'object') {
        return res.status(400).json({ error: 'Access levels are required' });
    }

    if (!assignedBy) {
        return res.status(400).json({ error: 'Assigned by is required' });
    }

    // Validate access levels
    const validAccessLevels = ['editor', 'viewer', 'no_access'];
    for (const [userId, accessLevel] of Object.entries(accessLevels)) {
        if (!validAccessLevels.includes(accessLevel)) {
            return res.status(400).json({ error: `Invalid access level: ${accessLevel}` });
        }
    }

    next();
};