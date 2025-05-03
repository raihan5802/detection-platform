const fs = require('fs');
const path = require('path');

/**
 * Find the first image in a directory (recursive)
 * @param {string} dir - Directory to search in
 * @param {string} baseDir - Base directory for relative paths
 * @return {string|null} - Relative path to the first image or null if not found
 */
function findFirstImage(dir, baseDir = dir) {
    if (!fs.existsSync(dir)) return null;

    const items = fs.readdirSync(dir);

    // First check if any of the items are user folders
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            // Check if this is a user folder (contains username and date)
            if (item.includes('_')) {
                // Look for image in user folders first
                const userFolderImage = findFirstImageInFolder(fullPath);
                if (userFolderImage) {
                    return path.join(item, userFolderImage).replace(/\\/g, '/');
                }
            }
        }
    }

    // If no user folders or no images in user folders, search directly
    return findFirstImageInFolder(dir, baseDir);
}

/**
 * Helper function to find first image in a specific folder
 * @param {string} dir - Directory to search in
 * @param {string} baseDir - Base directory for relative paths
 * @return {string|null} - Relative path to the first image or null if not found
 */
function findFirstImageInFolder(dir, baseDir = dir) {
    if (!fs.existsSync(dir)) return null;

    const items = fs.readdirSync(dir);

    // First check for image files directly in this directory
    const imageFile = items.find(item => {
        const fullPath = path.join(dir, item);
        const isFile = fs.statSync(fullPath).isFile();
        const ext = path.extname(item).toLowerCase();
        return isFile && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    });

    if (imageFile) {
        return path.relative(baseDir, path.join(dir, imageFile))
            .replace(/\\/g, '/'); // Normalize path separators
    }

    // If no image found, recursively search subdirectories
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findFirstImageInFolder(fullPath, baseDir);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Read directory recursively and return a tree structure
 * @param {string} dir - Directory to read
 * @return {Array} - Directory tree
 */
function readDirRecursive(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const items = fs.readdirSync(dir);
    return items.map(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return {
                name: item,
                type: 'folder',
                children: readDirRecursive(fullPath)
            };
        } else {
            return {
                name: item,
                type: 'file'
            };
        }
    });
}

/**
 * Count files recursively in a directory
 * @param {string} dir - Directory to count files in
 * @return {number} - Number of files
 */
function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;

    let count = 0;
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
            // Only count files with supported extensions
            const ext = path.extname(item).toLowerCase();
            const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
                '.mp4', '.avi', '.mov', '.mkv', '.webm',
                '.txt', '.doc', '.docx', '.pdf',
                '.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
            if (supportedExts.includes(ext)) {
                count++;
            }
        } else if (stat.isDirectory()) {
            count += countFiles(fullPath);
        }
    });

    return count;
}

/**
 * Get all files in a directory with access control
 * @param {string} dir - Directory to get files from
 * @param {Array} disabledFolders - List of disabled folder names
 * @param {string} basePath - Base path for relative paths
 * @param {string} projectPath - Project path for URLs
 * @param {boolean} includePaths - Whether to include full path info
 * @param {number} port - Server port for URLs
 * @return {Array} - List of files
 */
function getAllFilesWithAccessControl(dir, disabledFolders = [], basePath = '', projectPath = '', includePaths = false, port = 4000) {
    let results = [];

    if (!fs.existsSync(dir)) {
        return results;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);

        // Skip hidden files
        if (item.startsWith('.')) {
            continue;
        }

        if (fs.statSync(fullPath).isDirectory()) {
            // Check if this is a user folder (username_YYYYMMDD)
            // if (item.includes('_20') && disabledFolders.includes(item)) {
            //     // Skip this folder and all its contents if it's disabled
            //     continue;
            // }

            // Recursively process subfolders
            results = results.concat(getAllFilesWithAccessControl(fullPath, disabledFolders, relativePath, projectPath, includePaths, port));
        } else {
            // Only add files with supported extensions
            const ext = path.extname(item).toLowerCase();
            const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
                '.mp4', '.avi', '.mov', '.mkv', '.webm',
                '.txt', '.doc', '.docx', '.pdf',
                '.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];

            if (supportedExts.includes(ext)) {
                if (includePaths) {
                    results.push({
                        path: relativePath,
                        url: `http://localhost:${port}/${projectPath}/${relativePath}`
                    });
                } else {
                    results.push(`http://localhost:${port}/${projectPath}/${relativePath}`);
                }
            }
        }
    }

    return results;
}

/**
 * Recursively delete a directory
 * @param {string} dirPath - Directory to delete
 */
function deleteFolderRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // Recursive call
                deleteFolderRecursive(curPath);
            } else {
                // Delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

module.exports = {
    findFirstImage,
    findFirstImageInFolder,
    readDirRecursive,
    countFiles,
    getAllFilesWithAccessControl,
    deleteFolderRecursive
};