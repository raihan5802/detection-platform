const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const { pool } = require('./config/database');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const fileRoutes = require('./routes/fileRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const roleRoutes = require('./routes/roleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const annotationRoutes = require('./routes/annotationRoutes');
const authRoutes = require('./routes/authRoutes');
const dataAccessRoutes = require('./routes/dataAccessRoutes');
const keypointsRoutes = require('./routes/keypointsRoutes');

// Import file access middleware
const { fileAccessMiddleware } = require('./middleware/fileAccessMiddleware');

// Test database connection
pool.connect((err, client, done) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    } else {
        console.log('Successfully connected to PostgreSQL database');
        done();
    }
});

// Serve uploads directory with access middleware
app.use('/uploads', fileAccessMiddleware, express.static(path.join(__dirname, '..', 'uploads')));

// Register routes
app.use('/api', fileRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', roleRoutes);
app.use('/api', notificationRoutes);
app.use('/api', annotationRoutes);
app.use('/api', authRoutes);
app.use('/api', dataAccessRoutes);
app.use('/api', keypointsRoutes);

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => {
        clients.delete(ws);
    });
});

// Store clients in app.locals for access from controllers
app.locals.clients = clients;