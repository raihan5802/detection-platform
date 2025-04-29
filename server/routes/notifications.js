const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/notifications
 * @desc Create a new notification
 * @access Private
 */
router.post('/', authenticate, notificationController.createNotification);

/**
 * @route GET /api/notifications/:userId
 * @desc Get notifications for a user
 * @access Private
 */
router.get('/:userId', authenticate, notificationController.getUserNotifications);

/**
 * @route PUT /api/notifications/:notificationId
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:notificationId', authenticate, notificationController.markAsRead);

/**
 * @route PUT /api/notifications/mark-all/:userId
 * @desc Mark all notifications as read for a user
 * @access Private
 */
router.put('/mark-all/:userId', authenticate, notificationController.markAllAsRead);

/**
 * @route DELETE /api/notifications/:notificationId
 * @desc Delete a notification
 * @access Private
 */
router.delete('/:notificationId', authenticate, notificationController.deleteNotification);

module.exports = router;