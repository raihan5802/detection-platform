const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Server configuration
const configureServer = (app) => {
    // Set port
    const PORT = process.env.PORT || 4000;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Serve uploads directory
    app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

    return {
        PORT
    };
};

module.exports = configureServer;