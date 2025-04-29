const WebSocket = require('ws');

// Store for WebSocket clients
let wss = null;
const clients = new Set();

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {Object} WebSocket server instance
 */
exports.initializeWebSocketServer = (server) => {
    // Create WebSocket server
    wss = new WebSocket.Server({ server });

    // Connection handler
    wss.on('connection', (ws) => {
        // Add client to set
        clients.add(ws);

        // Set up heartbeat to detect disconnected clients
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Remove client when connection is closed
        ws.on('close', () => {
            clients.delete(ws);
        });

        // Handle incoming messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                // Handle specific message types
                switch (data.type) {
                    case 'PING':
                        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
                        break;

                    default:
                        // Unknown message type, ignore
                        break;
                }
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Connected to Detection Platform WebSocket server',
            timestamp: new Date().toISOString()
        }));
    });

    // Set up interval to check for disconnected clients
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                clients.delete(ws);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Handle server close
    wss.on('close', () => {
        clearInterval(interval);
    });

    return wss;
};

/**
 * Broadcast message to all connected clients
 * @param {Object} data - Data to broadcast
 */
exports.broadcastToAll = (data) => {
    if (!wss) {
        console.error('WebSocket server not initialized');
        return;
    }

    const message = JSON.stringify(data);

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

/**
 * Broadcast data change notification
 * @param {string} projectId - ID of project that changed
 * @param {string} changeType - Type of change (e.g., 'DATA_UPLOAD', 'ACCESS_CHANGE')
 * @param {Object} details - Additional details about the change
 */
exports.broadcastDataChange = (projectId, changeType = 'DATA_CHANGE', details = {}) => {
    this.broadcastToAll({
        type: changeType,
        projectId,
        timestamp: new Date().toISOString(),
        details
    });
};

/**
 * Broadcast task update notification
 * @param {string} taskId - ID of task that was updated
 * @param {string} changeType - Type of change (e.g., 'ANNOTATION_UPDATE', 'ACCESS_CHANGE')
 * @param {Object} details - Additional details about the update
 */
exports.broadcastTaskUpdate = (taskId, changeType = 'TASK_UPDATE', details = {}) => {
    this.broadcastToAll({
        type: changeType,
        taskId,
        timestamp: new Date().toISOString(),
        details
    });
};

/**
 * Send message to specific user
 * @param {string} userId - ID of user to send message to
 * @param {Object} data - Data to send
 */
exports.sendToUser = (userId, data) => {
    if (!wss) {
        console.error('WebSocket server not initialized');
        return;
    }

    const message = JSON.stringify({
        ...data,
        recipient: userId
    });

    // Find client connections for this user and send the message
    // Note: This requires storing user information with each connection
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(message);
        }
    });
};

/**
 * Get number of connected clients
 * @returns {number} Number of connected clients
 */
exports.getConnectedClientCount = () => {
    return clients.size;
};