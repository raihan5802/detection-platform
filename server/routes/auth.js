const express = require('express');
const authController = require('../controllers/authController');
const { validateSignUp, validateSignIn } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', validateSignUp, authController.signup);

/**
 * @route POST /api/auth/signin
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/signin', validateSignIn, authController.signin);

/**
 * @route GET /api/auth/users
 * @desc Get all users
 * @access Private (should be restricted in production)
 */
router.get('/users', authController.getAllUsers);

/**
 * @route GET /api/auth/users/:userId
 * @desc Get user by ID
 * @access Private
 */
router.get('/users/:userId', authController.getUserById);

module.exports = router;