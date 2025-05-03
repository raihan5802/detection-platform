const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Get all users
router.get('/users', authController.getUsers);

// Sign up a new user
router.post('/signup', authController.signup);

// Sign in a user
router.post('/signin', authController.signin);

module.exports = router;