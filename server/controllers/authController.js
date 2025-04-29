const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Create new user
        const user = await User.create({
            id: uuidv4(),
            username,
            email,
            password, // Note: In production, password should be hashed
            created_at: new Date()
        });

        res.status(201).json({
            message: 'User signed up successfully',
            userId: user.id
        });
    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).json({ error: 'Error signing up user' });
    }
};

/**
 * Authenticate user and get token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ where: { email } });

        // Check if user exists and password is correct
        if (!user || user.password !== password) { // In production, use proper password comparison
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Return user data (excluding password)
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        res.json({ user: userData });
    } catch (error) {
        console.error('Error signing in user:', error);
        res.status(500).json({ error: 'Error signing in' });
    }
};

/**
 * Get all users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email'] // Exclude password
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

/**
 * Get user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email'] // Exclude password
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};