const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create a notification
router.post('/notifications', notificationController.createNotification);

// Send notifications when data is uploaded
router.post('/notifications/data-upload', notificationController.createDataUploadNotifications);

// Get notifications for a user
router.get('/notifications/:userId', notificationController.getUserNotifications);

// Mark a notification as read
router.put('/notifications/:notificationId', notificationController.markNotificationAsRead);

module.exports = router;