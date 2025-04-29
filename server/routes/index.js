// routes/index.js

const express = require('express');
const authRoutes = require('./auth');
const projectRoutes = require('./projects');
const taskRoutes = require('./tasks');
const uploadRoutes = require('./uploads');
const roleRoutes = require('./roles');
const notificationRoutes = require('./notifications');
const annotationRoutes = require('./annotations');
const dataAccessRoutes = require('./dataAccess');

const router = express.Router();

// Mount all routes
router.use('/api/auth', authRoutes);
router.use('/api/projects', projectRoutes);
router.use('/api/tasks', taskRoutes);
router.use('/api/uploads', uploadRoutes);
router.use('/api/roles', roleRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/annotations', annotationRoutes);
router.use('/api/data-access', dataAccessRoutes);

// Simple health check endpoint
router.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;