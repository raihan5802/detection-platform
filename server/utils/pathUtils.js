const path = require('path');
const { pool } = require('../config/database');

/**
 * Get a folder ID from a project ID
 * @param {string} projectId - Project ID
 * @return {Promise<Object>} - Object containing folderId and projectPath
 */
async function getFolderIdFromProjectId(projectId) {
    try {
        const result = await pool.query(
            'SELECT folder_path FROM projects WHERE project_id = $1',
            [projectId]
        );

        if (result.rows.length === 0) {
            return { folderId: null, projectPath: null };
        }

        const folderPath = result.rows[0].folder_path;
        const parts = folderPath.split('/');

        return {
            folderId: parts[1], // Extract folder ID from path like "uploads/abcd123"
            projectPath: folderPath
        };
    } catch (error) {
        console.error('Error getting folder ID from project ID:', error);
        return { folderId: null, projectPath: null };
    }
}

/**
 * Get a project ID from a folder ID
 * @param {string} folderId - Folder ID
 * @return {Promise<string|null>} - Project ID or null if not found
 */
async function getProjectIdFromFolderId(folderId) {
    try {
        const result = await pool.query(
            'SELECT project_id FROM projects WHERE folder_path LIKE $1',
            [`%/${folderId}%`]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].project_id;
    } catch (error) {
        console.error('Error getting project ID from folder ID:', error);
        return null;
    }
}

/**
 * Get user ID from email
 * @param {string} email - User email
 * @return {Promise<string|null>} - User ID or null if not found
 */
async function getUserIdFromEmail(email) {
    try {
        const result = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].id;
    } catch (error) {
        console.error('Error getting user ID from email:', error);
        return null;
    }
}

/**
 * Get username from user ID
 * @param {string} userId - User ID
 * @return {Promise<string>} - Username or "Unknown" if not found
 */
async function getUsernameFromId(userId) {
    try {
        const result = await pool.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return "Unknown";
        }

        return result.rows[0].username;
    } catch (error) {
        console.error('Error getting username from ID:', error);
        return "Unknown";
    }
}

module.exports = {
    getFolderIdFromProjectId,
    getProjectIdFromFolderId,
    getUserIdFromEmail,
    getUsernameFromId
};