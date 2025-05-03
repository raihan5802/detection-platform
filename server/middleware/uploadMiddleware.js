const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// Helper function to get username and id from PostgreSQL database
async function getUserInfoFromDatabase(userId) {
    if (!userId) return { username: 'unknown_user', id: 'unknown' };

    try {
        const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        if (result.rows.length > 0) {
            return {
                username: result.rows[0].username.replace(/[^a-zA-Z0-9_-]/g, '_'), // Sanitize username for folder name
                id: result.rows[0].id
            };
        }
    } catch (err) {
        console.error('Error fetching user info from database:', err);
    }

    return { username: 'unknown_user', id: 'unknown' };
}

// Debugging helper to log file information
function logFileInfo(req, file) {
    console.log('--- File Upload Debug Info ---');
    console.log('File name:', file.originalname);
    console.log('webkitRelativePath:', file.webkitRelativePath);
    console.log('fieldname:', file.fieldname);

    if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
        const matchingPath = req.body.filePaths.find(p => p.includes(file.originalname));
        console.log('Matching filePath:', matchingPath);
    }
    console.log('---------------------------');
}

// Configure multer storage for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            let folderId = req.params.folderId || req.body.folderId;
            if (!folderId) {
                folderId = uuidv4();
                req.body.folderId = folderId;
            }

            // Get current user information
            const userData = req.headers.authorization || req.body.userId;
            let username = 'unknown_user';
            let userId = 'unknown';

            // Extract username from request if available
            if (userData) {
                try {
                    // If it's a JWT token
                    if (userData.startsWith('Bearer ')) {
                        // Implement JWT parsing if needed
                    }
                    // If it's a user ID from form data
                    else if (req.body.userId) {
                        // Look up username from PostgreSQL database
                        const userInfo = await getUserInfoFromDatabase(req.body.userId);
                        username = userInfo.username;
                        userId = userInfo.id;
                    }
                } catch (err) {
                    console.error('Error parsing user data:', err);
                }
            }

            // Create user-specific subfolder inside the folderId folder - use username_userId format
            const userFolder = username + '_' + userId;

            // Get the relative path from webkitRelativePath (excluding the file name)
            let relativePath = '';
            if (file.webkitRelativePath) {
                logFileInfo(req, file); // Add debug logging
                const pathParts = file.webkitRelativePath.split('/');
                // Remove the root folder name and the file name
                pathParts.shift(); // Remove root folder (test1)
                pathParts.pop();   // Remove file name
                relativePath = pathParts.join('/');
                console.log('Calculated relativePath:', relativePath);
            }

            // Create full upload path including user subfolder and subdirectories
            const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
            console.log('Creating directory:', uploadPath);
            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            console.error('Error in storage destination:', error);
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Extract just the filename without the path
        const filename = file.originalname;
        cb(null, filename);
    }
});

// Multer middleware for handling file uploads
const multerMiddleware = multer({
    storage: multer.diskStorage({
        destination: async function (req, file, cb) {
            try {
                let folderId = req.params.folderId || req.body.folderId;
                if (!folderId) {
                    folderId = uuidv4();
                    req.body.folderId = folderId;
                }

                // Get current user information
                const userData = req.headers.authorization || req.body.userId;
                let username = 'unknown_user';
                let userId = 'unknown';

                // Extract username from request if available
                if (userData) {
                    try {
                        // If it's a JWT token
                        if (userData.startsWith('Bearer ')) {
                            // Implement JWT parsing if needed
                        }
                        // If it's a user ID from form data
                        else if (req.body.userId) {
                            // Look up username from PostgreSQL database
                            const userInfo = await getUserInfoFromDatabase(req.body.userId);
                            username = userInfo.username;
                            userId = userInfo.id;
                        }
                    } catch (err) {
                        console.error('Error parsing user data:', err);
                    }
                }

                // Create user-specific subfolder inside the folderId folder - use username_userId format
                const userFolder = username + '_' + userId;

                // Check if this is a file from folder upload
                const isFromFolderUpload = file.webkitRelativePath ||
                    (req.body.filePaths &&
                        Array.isArray(req.body.filePaths) &&
                        req.body.filePaths.some(p => p.includes('/')));

                // For regular file uploads (not from folder structure)
                if (!isFromFolderUpload) {
                    const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
                    fs.mkdirSync(uploadPath, { recursive: true });
                    cb(null, uploadPath);
                    return;
                }

                // For folder uploads
                let relativePath = '';

                // Find the relative path for this file
                if (file.webkitRelativePath) {
                    logFileInfo(req, file); // Add debug logging
                    // Use webkitRelativePath if available
                    const pathParts = file.webkitRelativePath.split('/');

                    // If file is directly in the root folder (only 2 parts: folderName/fileName)
                    if (pathParts.length === 2) {
                        relativePath = 'roots';
                    } else {
                        // Remove the root folder name and the file name
                        pathParts.shift(); // Remove root folder name
                        pathParts.pop();   // Remove file name
                        relativePath = pathParts.join('/');
                    }
                    console.log('Calculated relativePath from webkitRelativePath:', relativePath);
                } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
                    // Try to find the path from filePaths array
                    const filePath = req.body.filePaths.find(p => p.includes(file.originalname));
                    if (filePath) {
                        const pathParts = filePath.split('/');

                        // If file is directly in the root folder (only 2 parts: folderName/fileName)
                        if (pathParts.length === 2) {
                            relativePath = 'roots';
                        } else {
                            // Remove the root folder name and the file name
                            pathParts.shift(); // Remove root folder name
                            pathParts.pop();   // Remove file name
                            relativePath = pathParts.join('/');
                        }
                        console.log('Calculated relativePath from filePaths:', relativePath);
                    } else {
                        // Default to roots if no path information is found
                        relativePath = 'roots';
                        console.log('No matching filePath found, using roots');
                    }
                } else {
                    // Default to roots if no path information is available
                    relativePath = 'roots';
                    console.log('No path information available, using roots');
                }

                // Create full upload path with user subfolder
                const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
                console.log('Creating directory:', uploadPath);
                fs.mkdirSync(uploadPath, { recursive: true });
                cb(null, uploadPath);
            } catch (error) {
                console.error('Error in multerMiddleware destination:', error);
                cb(error);
            }
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
});

// Create a upload handler for specific endpoints
const configureUploadMiddleware = (req, res, next) => {
    try {
        // Configure multer storage specifically for this route
        const uploadStorage = multer.diskStorage({
            destination: async function (req, file, cb) {
                try {
                    const folderId = req.params.folderId;
                    if (!folderId) {
                        throw new Error('No folderId provided in route parameters');
                    }

                    // Get current user information
                    const userData = req.headers.authorization || req.body.userId;
                    let username = 'unknown_user';
                    let userId = 'unknown';

                    // Extract username from request if available
                    if (userData) {
                        try {
                            // If it's a JWT token
                            if (userData.startsWith('Bearer ')) {
                                // Implement JWT parsing if needed
                            }
                            // If it's a user ID from form data
                            else if (req.body.userId) {
                                // Look up username from PostgreSQL database
                                const userInfo = await getUserInfoFromDatabase(req.body.userId);
                                username = userInfo.username;
                                userId = userInfo.id;
                            }
                        } catch (err) {
                            console.error('Error parsing user data:', err);
                        }
                    }

                    // Create user-specific subfolder inside the folderId folder - use username_userId format
                    const userFolder = username + '_' + userId;
                    req.userFolder = userFolder; // Store for later use in the controller

                    // Check if this is a file from folder upload
                    console.log('File in configureUploadMiddleware:', file.originalname);
                    console.log('webkitRelativePath:', file.webkitRelativePath);
                    console.log('Has filePaths:', req.body.filePaths && Array.isArray(req.body.filePaths));

                    // Check if this is a file from folder upload by checking webkitRelativePath
                    if (file.webkitRelativePath) {
                        const pathParts = file.webkitRelativePath.split('/');
                        console.log('pathParts:', pathParts);

                        // Store original webkitRelativePath for later use
                        file.originalWebkitRelativePath = file.webkitRelativePath;

                        // If file is directly in the root folder (only 2 parts: folderName/fileName)
                        if (pathParts.length === 2) {
                            const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
                            console.log('Creating direct root path:', uploadPath);
                            fs.mkdirSync(uploadPath, { recursive: true });
                            cb(null, uploadPath);
                        } else {
                            // Remove the root folder name and the file name
                            pathParts.shift(); // Remove root folder name
                            pathParts.pop();   // Remove file name
                            const relativePath = pathParts.join('/');
                            console.log('Creating nested path with relativePath:', relativePath);

                            // Create full upload path with user subfolder
                            const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
                            console.log('Full path:', uploadPath);
                            fs.mkdirSync(uploadPath, { recursive: true });
                            cb(null, uploadPath);
                        }
                    } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
                        // Try to find the path from filePaths array
                        const filePath = req.body.filePaths.find(p => p.includes(file.originalname));
                        if (filePath) {
                            const pathParts = filePath.split('/');
                            console.log('pathParts from filePaths:', pathParts);

                            // If file is directly in the root folder (only 2 parts: folderName/fileName)
                            if (pathParts.length === 2) {
                                const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
                                console.log('Creating roots path from filePaths:', uploadPath);
                                fs.mkdirSync(uploadPath, { recursive: true });
                                cb(null, uploadPath);
                            } else {
                                // Remove the root folder name and the file name
                                pathParts.shift(); // Remove root folder name
                                pathParts.pop();   // Remove file name
                                const relativePath = pathParts.join('/');
                                console.log('Creating nested path from filePaths with relativePath:', relativePath);

                                // Create full upload path with user subfolder
                                const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
                                console.log('Full path from filePaths:', uploadPath);
                                fs.mkdirSync(uploadPath, { recursive: true });
                                cb(null, uploadPath);
                            }
                        } else {
                            // Default to roots if no path information is found
                            const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
                            console.log('No matching filePath, creating default roots path:', uploadPath);
                            fs.mkdirSync(uploadPath, { recursive: true });
                            cb(null, uploadPath);
                        }
                    } else {
                        // For regular file uploads (not from folder structure)
                        const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
                        console.log('Creating standard roots path:', uploadPath);
                        fs.mkdirSync(uploadPath, { recursive: true });
                        cb(null, uploadPath);
                    }
                } catch (error) {
                    console.error('Error in uploadStorage destination:', error);
                    cb(error);
                }
            },
            filename: function (req, file, cb) {
                cb(null, file.originalname);
            }
        });

        const upload = multer({ storage: uploadStorage }).array('files');

        upload(req, res, (err) => {
            if (err) {
                console.error('Upload error:', err);
                return res.status(500).json({ error: 'Failed to upload files', details: err.message });
            }
            console.log('Upload successful for', req.files ? req.files.length : 0, 'files');
            next();
        });
    } catch (error) {
        console.error('Error in configureUploadMiddleware:', error);
        return res.status(500).json({ error: 'Failed to configure upload middleware', details: error.message });
    }
};

module.exports = {
    upload: multer({ storage }),
    multerMiddleware,
    configureUploadMiddleware
};


// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const { v4: uuidv4 } = require('uuid');
// const { usersFilePath } = require('../config/database');

// // Configure multer storage for file uploads
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         let folderId = req.params.folderId || req.body.folderId;
//         if (!folderId) {
//             folderId = uuidv4();
//             req.body.folderId = folderId;
//         }

//         // Get current user information
//         const userData = req.headers.authorization || req.body.userId;
//         let username = 'unknown_user';

//         // Extract username from request if available
//         if (userData) {
//             try {
//                 // If it's a JWT token
//                 if (userData.startsWith('Bearer ')) {
//                     // Implement JWT parsing if needed
//                 }
//                 // If it's a user ID from form data
//                 else if (req.body.userId) {
//                     // Look up username from users.csv
//                     if (fs.existsSync(usersFilePath)) {
//                         const usersContent = fs.readFileSync(usersFilePath, 'utf8');
//                         const userLines = usersContent.trim().split('\n').slice(1);
//                         const userLine = userLines.find(line => {
//                             const [id] = line.split(',');
//                             return id === req.body.userId;
//                         });
//                         if (userLine) {
//                             const [id, name] = userLine.split(',');
//                             username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
//                         }
//                     }
//                 }
//             } catch (err) {
//                 console.error('Error parsing user data:', err);
//             }
//         }

//         // Create user-specific subfolder inside the folderId folder
//         const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

//         // Get the relative path from webkitRelativePath (excluding the file name)
//         let relativePath = '';
//         if (file.webkitRelativePath) {
//             const pathParts = file.webkitRelativePath.split('/');
//             // Remove the root folder name and the file name
//             pathParts.shift(); // Remove root folder (test1)
//             pathParts.pop();   // Remove file name
//             relativePath = pathParts.join('/');
//         }

//         // Create full upload path including user subfolder and subdirectories
//         const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
//         fs.mkdirSync(uploadPath, { recursive: true });
//         cb(null, uploadPath);
//     },
//     filename: (req, file, cb) => {
//         // Extract just the filename without the path
//         const filename = file.originalname;
//         cb(null, filename);
//     }
// });

// // Multer middleware for handling file uploads
// const multerMiddleware = multer({
//     storage: multer.diskStorage({
//         destination: function (req, file, cb) {
//             let folderId = req.params.folderId || req.body.folderId;
//             if (!folderId) {
//                 folderId = uuidv4();
//                 req.body.folderId = folderId;
//             }

//             // Get current user information
//             const userData = req.headers.authorization || req.body.userId;
//             let username = 'unknown_user';

//             // Extract username from request if available
//             if (userData) {
//                 try {
//                     // If it's a JWT token
//                     if (userData.startsWith('Bearer ')) {
//                         // Implement JWT parsing if needed
//                     }
//                     // If it's a user ID from form data
//                     else if (req.body.userId) {
//                         // Look up username from users.csv
//                         if (fs.existsSync(usersFilePath)) {
//                             const usersContent = fs.readFileSync(usersFilePath, 'utf8');
//                             const userLines = usersContent.trim().split('\n').slice(1);
//                             const userLine = userLines.find(line => {
//                                 const [id] = line.split(',');
//                                 return id === req.body.userId;
//                             });
//                             if (userLine) {
//                                 const [id, name] = userLine.split(',');
//                                 username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
//                             }
//                         }
//                     }
//                 } catch (err) {
//                     console.error('Error parsing user data:', err);
//                 }
//             }

//             // Create user-specific subfolder inside the folderId folder
//             const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

//             // Check if this is a file from folder upload
//             const isFromFolderUpload = file.webkitRelativePath ||
//                 (req.body.filePaths &&
//                     Array.isArray(req.body.filePaths) &&
//                     req.body.filePaths.some(p => p.includes('/')));

//             // For regular file uploads (not from folder structure)
//             if (!isFromFolderUpload) {
//                 const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
//                 fs.mkdirSync(uploadPath, { recursive: true });
//                 cb(null, uploadPath);
//                 return;
//             }

//             // For folder uploads
//             let relativePath = '';

//             // Find the relative path for this file
//             if (file.webkitRelativePath) {
//                 // Use webkitRelativePath if available
//                 const pathParts = file.webkitRelativePath.split('/');

//                 // If file is directly in the root folder (only 2 parts: folderName/fileName)
//                 if (pathParts.length === 2) {
//                     relativePath = 'roots';
//                 } else {
//                     // Remove the root folder name and the file name
//                     pathParts.shift(); // Remove root folder name
//                     pathParts.pop();   // Remove file name
//                     relativePath = pathParts.join('/');
//                 }
//             } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
//                 // Try to find the path from filePaths array
//                 const filePath = req.body.filePaths.find(p => p.includes(file.originalname));
//                 if (filePath) {
//                     const pathParts = filePath.split('/');

//                     // If file is directly in the root folder (only 2 parts: folderName/fileName)
//                     if (pathParts.length === 2) {
//                         relativePath = 'roots';
//                     } else {
//                         // Remove the root folder name and the file name
//                         pathParts.shift(); // Remove root folder name
//                         pathParts.pop();   // Remove file name
//                         relativePath = pathParts.join('/');
//                     }
//                 } else {
//                     // Default to roots if no path information is found
//                     relativePath = 'roots';
//                 }
//             } else {
//                 // Default to roots if no path information is available
//                 relativePath = 'roots';
//             }

//             // Create full upload path with user subfolder
//             const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
//             fs.mkdirSync(uploadPath, { recursive: true });
//             cb(null, uploadPath);
//         },
//         filename: function (req, file, cb) {
//             cb(null, file.originalname);
//         }
//     })
// });

// // Create a upload handler for specific endpoints
// const configureUploadMiddleware = (req, res, next) => {
//     // Configure multer storage specifically for this route
//     const uploadStorage = multer.diskStorage({
//         destination: function (req, file, cb) {
//             const folderId = req.params.folderId;

//             // Get current user information
//             const userData = req.headers.authorization || req.body.userId;
//             let username = 'unknown_user';

//             // Extract username from request if available
//             if (userData) {
//                 try {
//                     // If it's a JWT token
//                     if (userData.startsWith('Bearer ')) {
//                         // Implement JWT parsing if needed
//                     }
//                     // If it's a user ID from form data
//                     else if (req.body.userId) {
//                         // Look up username from users.csv
//                         if (fs.existsSync(usersFilePath)) {
//                             const usersContent = fs.readFileSync(usersFilePath, 'utf8');
//                             const userLines = usersContent.trim().split('\n').slice(1);
//                             const userLine = userLines.find(line => {
//                                 const [id] = line.split(',');
//                                 return id === req.body.userId;
//                             });
//                             if (userLine) {
//                                 const [id, name] = userLine.split(',');
//                                 username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
//                             }
//                         }
//                     }
//                 } catch (err) {
//                     console.error('Error parsing user data:', err);
//                 }
//             }

//             // Create user-specific subfolder inside the folderId folder
//             const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
//             req.userFolder = userFolder; // Store for later use in the controller

//             // Check if this is a file from folder upload by checking webkitRelativePath
//             if (file.webkitRelativePath) {
//                 const pathParts = file.webkitRelativePath.split('/');

//                 // Store original webkitRelativePath for later use
//                 file.originalWebkitRelativePath = file.webkitRelativePath;

//                 // If file is directly in the root folder (only 2 parts: folderName/fileName)
//                 if (pathParts.length === 2) {
//                     const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
//                     fs.mkdirSync(uploadPath, { recursive: true });
//                     cb(null, uploadPath);
//                 } else {
//                     // Remove the root folder name and the file name
//                     pathParts.shift(); // Remove root folder name
//                     pathParts.pop();   // Remove file name
//                     const relativePath = pathParts.join('/');

//                     // Create full upload path with user subfolder
//                     const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, relativePath);
//                     fs.mkdirSync(uploadPath, { recursive: true });
//                     cb(null, uploadPath);
//                 }
//             } else {
//                 // For regular file uploads (not from folder structure)
//                 const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderId, userFolder, 'roots');
//                 fs.mkdirSync(uploadPath, { recursive: true });
//                 cb(null, uploadPath);
//             }
//         },
//         filename: function (req, file, cb) {
//             cb(null, file.originalname);
//         }
//     });

//     const upload = multer({ storage: uploadStorage }).array('files');

//     upload(req, res, (err) => {
//         if (err) {
//             return res.status(500).json({ error: 'Failed to upload files' });
//         }
//         next();
//     });
// };

// module.exports = {
//     upload: multer({ storage }),
//     multerMiddleware,
//     configureUploadMiddleware
// };