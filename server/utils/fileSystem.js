const fs = require('fs');
const path = require('path');

/**
 * Create directory recursively if it doesn't exist
 * @param {string} directoryPath - Path to directory
 * @returns {boolean} True if directory was created or already exists
 */
exports.ensureDirectoryExists = (directoryPath) => {
    try {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }
        return true;
    } catch (error) {
        console.error(`Error creating directory ${directoryPath}:`, error);
        return false;
    }
};

/**
 * Delete directory recursively
 * @param {string} directoryPath - Path to directory
 * @returns {boolean} True if directory was deleted successfully
 */
exports.deleteDirectory = (directoryPath) => {
    try {
        if (!fs.existsSync(directoryPath)) {
            return true; // Directory doesn't exist, so deletion is "successful"
        }

        // Recursively delete all contents
        const deleteFolderRecursive = (dirPath) => {
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
        };

        deleteFolderRecursive(directoryPath);
        return true;
    } catch (error) {
        console.error(`Error deleting directory ${directoryPath}:`, error);
        return false;
    }
};

/**
 * Find first image in a directory recursively
 * @param {string} directoryPath - Path to directory
 * @param {string[]} extensions - Array of image extensions to look for
 * @returns {string|null} Path to first image or null if none found
 */
exports.findFirstImage = (directoryPath, extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']) => {
    if (!fs.existsSync(directoryPath)) {
        return null;
    }

    const items = fs.readdirSync(directoryPath);

    // First check for image files directly in this directory
    const imageFile = items.find(item => {
        const fullPath = path.join(directoryPath, item);
        const isFile = fs.statSync(fullPath).isFile();
        const ext = path.extname(item).toLowerCase();
        return isFile && extensions.includes(ext);
    });

    if (imageFile) {
        return path.join(directoryPath, imageFile);
    }

    // If no image found, recursively search subdirectories
    for (const item of items) {
        const fullPath = path.join(directoryPath, item);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = this.findFirstImage(fullPath, extensions);
            if (found) return found;
        }
    }

    return null;
};

/**
 * Count files in a directory recursively
 * @param {string} directoryPath - Path to directory
 * @param {string[]} extensions - Array of file extensions to count (empty array counts all files)
 * @returns {number} Number of matching files
 */
exports.countFiles = (directoryPath, extensions = []) => {
    if (!fs.existsSync(directoryPath)) {
        return 0;
    }

    let count = 0;
    const items = fs.readdirSync(directoryPath);

    items.forEach(item => {
        const fullPath = path.join(directoryPath, item);

        if (fs.statSync(fullPath).isFile()) {
            if (extensions.length === 0) {
                // Count all files if no extensions specified
                count++;
            } else {
                // Only count files with matching extensions
                const ext = path.extname(item).toLowerCase();
                if (extensions.includes(ext)) {
                    count++;
                }
            }
        } else if (fs.statSync(fullPath).isDirectory()) {
            // Recursively count files in subdirectories
            count += this.countFiles(fullPath, extensions);
        }
    });

    return count;
};

/**
 * Read file safely with error handling
 * @param {string} filePath - Path to file
 * @param {string} encoding - File encoding
 * @returns {Object} Object with success flag and data or error
 */
exports.readFileSafe = (filePath, encoding = 'utf8') => {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File does not exist' };
        }

        const data = fs.readFileSync(filePath, encoding);
        return { success: true, data };
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Write file safely with error handling
 * @param {string} filePath - Path to file
 * @param {string|Buffer} data - Data to write
 * @param {string} encoding - File encoding
 * @returns {Object} Object with success flag and error if applicable
 */
exports.writeFileSafe = (filePath, data, encoding = 'utf8') => {
    try {
        // Ensure directory exists
        const dirPath = path.dirname(filePath);
        this.ensureDirectoryExists(dirPath);

        // Write file
        fs.writeFileSync(filePath, data, encoding);
        return { success: true };
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all files in a directory recursively
 * @param {string} directoryPath - Path to directory
 * @param {string[]} extensions - Array of file extensions to include (empty array includes all files)
 * @returns {string[]} Array of file paths
 */
exports.getAllFiles = (directoryPath, extensions = []) => {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    let results = [];
    const items = fs.readdirSync(directoryPath);

    for (const item of items) {
        const fullPath = path.join(directoryPath, item);

        if (fs.statSync(fullPath).isFile()) {
            if (extensions.length === 0) {
                // Include all files if no extensions specified
                results.push(fullPath);
            } else {
                // Only include files with matching extensions
                const ext = path.extname(item).toLowerCase();
                if (extensions.includes(ext)) {
                    results.push(fullPath);
                }
            }
        } else if (fs.statSync(fullPath).isDirectory()) {
            // Recursively get files from subdirectories
            results = results.concat(this.getAllFiles(fullPath, extensions));
        }
    }

    return results;
};