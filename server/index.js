// server/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { initializeModels } = require('./models');
const configureServer = require('./config/server-config');
const routes = require('./routes');
const websocket = require('./utils/websocket');
const fs = require('fs');
const { ensureDirectoryExists } = require('./utils/fileSystem');

// Initialize the Express app
const app = express();

// Apply server configuration
const { PORT } = configureServer(app);

// Add CORS and JSON parsing middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
ensureDirectoryExists(path.join(__dirname, '../uploads'));

// Serve static files from uploads directory with access control
app.use('/uploads', (req, res, next) => {
    const urlPath = req.path;
    const parts = urlPath.split('/');

    // We need at least [0:empty, 1:folderId, 2:userFolder, ...] to check access
    if (parts.length < 3) {
        return next(); // Let it go through if it's a direct access to the folderId level
    }

    const folderId = parts[1];
    const userFolder = parts[2];

    // Skip access check if userFolder doesn't match our pattern (username_YYYYMMDD)
    if (!userFolder.includes('_20')) {
        return next();
    }

    // Check for access flag file
    const accessFlagPath = path.join(__dirname, '../uploads', folderId, userFolder, '.access_disabled');
    if (fs.existsSync(accessFlagPath)) {
        // Return 404 Not Found instead of 403 Forbidden to make it look like the file doesn't exist
        return res.status(404).send('Not Found');
    }

    // Access is allowed
    next();
}, express.static(path.join(__dirname, '../uploads')));

// Mount all routes
app.use(routes);

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server
const wss = websocket.initializeWebSocketServer(server);

// Expose websocket functions to the app for broadcasting
app.set('broadcastDataChange', (projectId, changeType, details) => {
    websocket.broadcastDataChange(projectId, changeType, details);
});

app.set('broadcastTaskUpdate', (taskId, changeType, details) => {
    websocket.broadcastTaskUpdate(taskId, changeType, details);
});

// Initialize database models and start server
initializeModels()
    .then(() => {
        // Start the server after models are initialized
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to initialize database models:', err);
        process.exit(1);
    });

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Gracefully shutdown
    server.close(() => {
        process.exit(1);
    });

    // If server doesn't close in 5 seconds, force exit
    setTimeout(() => {
        process.exit(1);
    }, 5000);
});

module.exports = server; // Export for testing