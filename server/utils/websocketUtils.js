const WebSocket = require('ws');

/**
 * Function to broadcast data changes to all connected clients
 * @param {Set} clients - Set of connected WebSocket clients
 * @param {string} projectId - ID of the project that changed
 */
function broadcastDataChange(clients, projectId) {
    const message = JSON.stringify({
        type: 'DATA_CHANGE',
        projectId: projectId,
        timestamp: new Date().toISOString()
    });

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

module.exports = {
    broadcastDataChange
};