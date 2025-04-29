const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Serve /uploads
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

  // Find project ID for this folder
  let projectId = null;
  try {
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    for (const line of projectLines) {
      const [project_id, , , , , folder_path] = line.split(',');
      const pathParts = folder_path.split('/');
      if (pathParts[1] === folderId) {
        projectId = project_id;
        break;
      }
    }

    if (!projectId) {
      return next(); // Unable to find project, let it through
    }

    // Check for access flag file
    const accessFlagPath = path.join(__dirname, 'uploads', folderId, userFolder, '.access_disabled');
    if (fs.existsSync(accessFlagPath)) {
      // Return 404 Not Found instead of 403 Forbidden to make it look like the file doesn't exist
      return res.status(404).send('Not Found');
    }

    // Check data_access.csv for explicit access control
    if (fs.existsSync(dataAccessFilePath)) {
      const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      for (const line of accessLines) {
        const [record_project_id, record_folder_id, record_user_folder, is_enabled] = line.split(',');
        if (record_project_id === projectId && record_user_folder === userFolder) {
          if (is_enabled !== 'true') {
            // Return 404 Not Found instead of 403 Forbidden
            return res.status(404).send('Not Found');
          }
          break;
        }
      }
    }

    next(); // Access is allowed

  } catch (error) {
    console.error('Error checking file access:', error);
    next(); // In case of error, default to allowing access
  }
}, express.static(path.join(__dirname, 'uploads')));

const projectsFilePath = path.join(__dirname, 'projects.csv');
if (!fs.existsSync(projectsFilePath)) {
  fs.writeFileSync(projectsFilePath, 'project_id,user_id,project_name,project_type,label_classes,folder_path,created_at\n');
}

// Initialize tasks.csv if it doesn't exist
const tasksFilePath = path.join(__dirname, 'tasks.csv');
// Create tasks.csv with the new header if it doesn't exist
if (!fs.existsSync(tasksFilePath)) {
  fs.writeFileSync(tasksFilePath, 'task_id,user_id,project_id,task_name,project_name,annotation_type,selected_files,created_at\n');
}

// Add these right after the imports
const rolesFilePath = path.join(__dirname, 'roles.csv');
if (!fs.existsSync(rolesFilePath)) {
  fs.writeFileSync(rolesFilePath, 'role_id,project_id,user_id,role_type,assigned_by,assigned_at\n');
}

const notificationsFilePath = path.join(__dirname, 'notifications.csv');
if (!fs.existsSync(notificationsFilePath)) {
  fs.writeFileSync(notificationsFilePath, 'notification_id,user_id,message,is_read,related_project_id,created_at\n');
}

const taskAccessFilePath = path.join(__dirname, 'task_access.csv');
if (!fs.existsSync(taskAccessFilePath)) {
  fs.writeFileSync(taskAccessFilePath, 'task_id,user_id,access_level,assigned_by,assigned_at\n');
}

const dataAccessFilePath = path.join(__dirname, 'data_access.csv');
if (!fs.existsSync(dataAccessFilePath)) {
  fs.writeFileSync(dataAccessFilePath, 'project_id,folder_id,user_folder,is_enabled,updated_at\n');
}

// Update the original storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folderId = req.params.folderId || req.body.folderId;
    if (!folderId) {
      folderId = uuidv4();
      req.body.folderId = folderId;
    }

    // Get current user information
    const userData = req.headers.authorization || req.body.userId;
    let username = 'unknown_user';

    // Extract username from request if available
    if (userData) {
      try {
        // If it's a JWT token
        if (userData.startsWith('Bearer ')) {
          // Implement JWT parsing if needed
        }
        // If it's a user ID from form data
        else if (req.body.userId) {
          // Look up username from users.csv
          const usersFilePath = path.join(__dirname, 'users.csv');
          if (fs.existsSync(usersFilePath)) {
            const usersContent = fs.readFileSync(usersFilePath, 'utf8');
            const userLines = usersContent.trim().split('\n').slice(1);
            const userLine = userLines.find(line => {
              const [id] = line.split(',');
              return id === req.body.userId;
            });
            if (userLine) {
              const [id, name] = userLine.split(',');
              username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
            }
          }
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }

    // Create user-specific subfolder inside the folderId folder
    const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Get the relative path from webkitRelativePath (excluding the file name)
    let relativePath = '';
    if (file.webkitRelativePath) {
      const pathParts = file.webkitRelativePath.split('/');
      // Remove the root folder name and the file name
      pathParts.shift(); // Remove root folder (test1)
      pathParts.pop();   // Remove file name
      relativePath = pathParts.join('/');
    }

    // Create full upload path including user subfolder and subdirectories
    const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, relativePath);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Extract just the filename without the path
    const filename = file.originalname;
    cb(null, filename);
  }
});


// Update the multerMiddleware in server.js
const multerMiddleware = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      let folderId = req.params.folderId || req.body.folderId;
      if (!folderId) {
        folderId = uuidv4();
        req.body.folderId = folderId;
      }

      // Get current user information
      const userData = req.headers.authorization || req.body.userId;
      let username = 'unknown_user';

      // Extract username from request if available
      if (userData) {
        try {
          // If it's a JWT token
          if (userData.startsWith('Bearer ')) {
            // Implement JWT parsing if needed
          }
          // If it's a user ID from form data
          else if (req.body.userId) {
            // Look up username from users.csv
            const usersFilePath = path.join(__dirname, 'users.csv');
            if (fs.existsSync(usersFilePath)) {
              const usersContent = fs.readFileSync(usersFilePath, 'utf8');
              const userLines = usersContent.trim().split('\n').slice(1);
              const userLine = userLines.find(line => {
                const [id] = line.split(',');
                return id === req.body.userId;
              });
              if (userLine) {
                const [id, name] = userLine.split(',');
                username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
              }
            }
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }

      // Create user-specific subfolder inside the folderId folder
      const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Check if this is a file from folder upload
      const isFromFolderUpload = file.webkitRelativePath ||
        (req.body.filePaths &&
          Array.isArray(req.body.filePaths) &&
          req.body.filePaths.some(p => p.includes('/')));

      // For regular file uploads (not from folder structure)
      if (!isFromFolderUpload) {
        const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, 'roots');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
        return;
      }

      // For folder uploads
      let relativePath = '';

      // Find the relative path for this file
      if (file.webkitRelativePath) {
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
        } else {
          // Default to roots if no path information is found
          relativePath = 'roots';
        }
      } else {
        // Default to roots if no path information is available
        relativePath = 'roots';
      }

      // Create full upload path with user subfolder
      const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, relativePath);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  })
});

const upload = multer({ storage });

// File upload endpoint
app.post('/api/upload', multerMiddleware.array('files'), (req, res) => {
  const folderId = req.body.folderId;
  const taskName = req.body.taskName || '';
  let labelClasses = [];
  try {
    labelClasses = JSON.parse(req.body.labelClasses);
  } catch (e) {
    labelClasses = [];
  }

  // Process files and preserve folder structure
  const uploadedFiles = req.files.map((f) => {
    // Extract relative path from the file
    let relativePath = '';
    if (f.originalname.includes('/')) {
      // Extract path from file name if multer doesn't preserve it
      relativePath = f.originalname.substring(0, f.originalname.lastIndexOf('/'));
      f.originalname = f.originalname.substring(f.originalname.lastIndexOf('/') + 1);
    } else if (f.webkitRelativePath) {
      // If webkitRelativePath is available (might need middleware to preserve)
      relativePath = f.webkitRelativePath.split('/').slice(0, -1).join('/');
    }

    return {
      originalname: f.originalname,
      relativePath: relativePath,
      url: `http://localhost:${PORT}/uploads/${folderId}/${relativePath ? relativePath + '/' : ''}${f.originalname}`
    };
  });

  res.json({
    folderId,
    taskName,
    labelClasses,
    files: uploadedFiles,
    message: 'Upload success'
  });
});

// New endpoint to create a project
app.post('/api/projects', (req, res) => {
  try {
    const {
      userId,
      projectName,
      folderId,
      projectType,
      labelClasses,
      dataProviderEmails, // Now an array
      collaboratorEmails, // Now an array
      hasData = true
    } = req.body;

    const projectId = uuidv4();
    const folderPath = path.join('uploads', folderId);
    const createdAt = new Date().toISOString();

    const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');
    // Add hasData field to the project record
    const projectLine = `${projectId},${userId},${projectName},${projectType},${escapedLabelClasses},${folderPath},${createdAt},${hasData}\n`;

    fs.appendFileSync(projectsFilePath, projectLine);

    // Always create at least the owner role assignment
    const timestamp = new Date().toISOString();
    const ownerRoleId = uuidv4();
    let roleLines = `${ownerRoleId},${projectId},${userId},project_owner,system,${timestamp}\n`;

    // Set to keep track of users we've already processed to avoid duplicates
    const processedUsers = new Set();

    // Find and add data provider roles
    if (dataProviderEmails && dataProviderEmails.length > 0) {
      const usersFilePath = path.join(__dirname, 'users.csv');
      if (fs.existsSync(usersFilePath)) {
        const usersContent = fs.readFileSync(usersFilePath, 'utf8');
        const userLines = usersContent.trim().split('\n').slice(1);

        for (const email of dataProviderEmails) {
          const dataProviderLine = userLines.find(line => {
            const [id, username, userEmail] = line.split(',');
            return userEmail === email;
          });

          if (dataProviderLine) {
            const dataProviderId = dataProviderLine.split(',')[0];

            // Skip if this user already has a role in this project
            const userKey = `${projectId}-${dataProviderId}`;
            if (processedUsers.has(userKey)) continue;

            processedUsers.add(userKey);

            const dataProviderRoleId = uuidv4();
            roleLines += `${dataProviderRoleId},${projectId},${dataProviderId},data_provider,${userId},${timestamp}\n`;

            // Create notification for the data provider
            const notificationId = uuidv4();
            const notificationMessage = `You have been assigned as data provider for project "${projectName}"`;
            const notificationLine = `${notificationId},${dataProviderId},${notificationMessage},false,${projectId},${timestamp}\n`;
            fs.appendFileSync(notificationsFilePath, notificationLine);
          }
        }
      }
    }

    // Find and add collaborator roles
    if (collaboratorEmails && collaboratorEmails.length > 0) {
      const usersFilePath = path.join(__dirname, 'users.csv');
      if (fs.existsSync(usersFilePath)) {
        const usersContent = fs.readFileSync(usersFilePath, 'utf8');
        const userLines = usersContent.trim().split('\n').slice(1);

        for (const email of collaboratorEmails) {
          const collaboratorLine = userLines.find(line => {
            const [id, username, userEmail] = line.split(',');
            return userEmail === email;
          });

          if (collaboratorLine) {
            const collaboratorId = collaboratorLine.split(',')[0];

            // Skip if this user already has a role in this project
            const userKey = `${projectId}-${collaboratorId}`;
            if (processedUsers.has(userKey)) continue;

            processedUsers.add(userKey);

            const collaboratorRoleId = uuidv4();
            roleLines += `${collaboratorRoleId},${projectId},${collaboratorId},collaborator,${userId},${timestamp}\n`;

            // Create notification for the collaborator
            const notificationId = uuidv4();
            const notificationMessage = `You have been assigned as collaborator for project "${projectName}"`;
            const notificationLine = `${notificationId},${collaboratorId},${notificationMessage},false,${projectId},${timestamp}\n`;
            fs.appendFileSync(notificationsFilePath, notificationLine);
          }
        }
      }
    }

    fs.appendFileSync(rolesFilePath, roleLines);

    res.json({
      projectId,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(projectsFilePath)) {
      return res.json([]);
    }

    // Get userId from query
    const userId = req.query.userId;

    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const lines = projectsContent.trim().split('\n').slice(1);
    let projects = lines.map(line => {
      const [project_id, user_id, project_name, project_type, label_classes, folder_path, created_at, hasData] = line.split(',');
      return {
        project_id,
        user_id,
        project_name,
        project_type,
        label_classes: JSON.parse(label_classes.replace(/\|/g, ',')),
        folder_path,
        created_at,
        hasData: hasData === 'true'
      };
    });

    // Filter projects by userId if provided
    if (userId) {
      projects = projects.filter(project => project.user_id === userId);
    }

    // Find thumbnail image for each project
    projects.forEach(proj => {
      const projectDir = path.join(__dirname, proj.folder_path);

      // Function to find the first image in a directory (recursive)
      const findFirstImage = (dir) => {
        if (!fs.existsSync(dir)) return null;

        const items = fs.readdirSync(dir);

        // First check if any of the items are user folders
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            // Check if this is a user folder (contains username and date)
            if (item.includes('_20')) {
              // Look for image in user folders first
              const userFolderImage = findFirstImageInFolder(fullPath);
              if (userFolderImage) {
                return path.join(item, userFolderImage).replace(/\\/g, '/');
              }
            }
          }
        }

        // If no user folders or no images in user folders, search directly
        return findFirstImageInFolder(dir);
      };

      // Helper function to find first image in a specific folder
      const findFirstImageInFolder = (dir) => {
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
          return path.relative(dir, path.join(dir, imageFile))
            .replace(/\\/g, '/'); // Normalize path separators
        }

        // If no image found, recursively search subdirectories
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findFirstImageInFolder(fullPath);
            if (found) return path.join(item, found).replace(/\\/g, '/');
          }
        }

        return null;
      };

      const relativePath = findFirstImage(projectDir);
      if (relativePath) {
        proj.thumbnailImage = `http://localhost:${PORT}/${proj.folder_path}/${relativePath}`;
      }
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Endpoint to get folder structure recursively for a given folderId
// Update the folder tree API endpoint
app.get('/api/folder-structure/:folderId(*)', (req, res) => {
  const folderId = decodeURIComponent(req.params.folderId);
  const basePath = path.join(__dirname, 'uploads', folderId);

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

  if (!fs.existsSync(basePath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  const tree = {
    name: path.basename(basePath),
    type: 'folder',
    children: readDirRecursive(basePath)
  };

  res.json(tree);
});

// Get a specific project by ID
app.get('/api/projects/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const lines = projectsContent.trim().split('\n').slice(1);

    for (const line of lines) {
      const [project_id, user_id, project_name, project_type, label_classes, folder_path, created_at, hasData] = line.split(',');

      if (project_id === projectId) {
        const project = {
          project_id,
          user_id,
          project_name,
          project_type,
          label_classes: JSON.parse(label_classes.replace(/\|/g, ',')),
          folder_path,
          created_at,
          hasData: hasData === 'true'
        };

        return res.json(project);
      }
    }

    res.status(404).json({ error: 'Project not found' });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project labels endpoint
app.put('/api/projects/:projectId/labels', (req, res) => {
  try {
    const { projectId } = req.params;
    const { labelClasses } = req.body; // expecting an array of label objects: {name, color}
    // Read projects.csv
    let projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    let lines = projectsContent.trim().split('\n');
    const header = lines[0];
    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // keep header
      let parts = line.split(',');
      if (parts[0] === projectId) {
        // update label_classes field (index 4)
        const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');
        parts[4] = escapedLabelClasses;
        return parts.join(',');
      }
      return line;
    });
    fs.writeFileSync(projectsFilePath, updatedLines.join('\n') + '\n');
    res.json({ message: 'Project labels updated successfully' });
  } catch (error) {
    console.error('Error updating project labels:', error);
    res.status(500).json({ error: 'Failed to update project labels' });
  }
});

// Update a project's data status
app.put('/api/projects/:projectId/update-data-status', (req, res) => {
  try {
    const { projectId } = req.params;
    const { hasData } = req.body;

    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const lines = projectsContent.trim().split('\n');
    const header = lines[0];

    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // keep header

      const parts = line.split(',');
      if (parts[0] === projectId) {
        // Update hasData field (last part)
        parts[parts.length - 1] = hasData;
        return parts.join(',');
      }
      return line;
    });

    fs.writeFileSync(projectsFilePath, updatedLines.join('\n') + '\n');
    res.json({ message: 'Project data status updated successfully' });
  } catch (error) {
    console.error('Error updating project data status:', error);
    res.status(500).json({ error: 'Failed to update project data status' });
  }
});

// In server.js, add the following endpoint:
app.post('/api/tasks', (req, res) => {
  const { userId, projectId, taskName, projectName, annotationType, selectedFolders, teamAccess } = req.body;

  // Validate required fields
  if (!userId || !projectId || !taskName || !projectName || !annotationType || !selectedFolders) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Extract only the folder paths that were checked
  const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
  if (selectedFolderPaths.length === 0) {
    return res.status(400).json({ error: "At least one folder must be selected" });
  }

  const taskId = uuidv4();
  const createdAt = new Date().toISOString();

  // Build a CSV line with selected_folder paths joined by semicolons
  const line = `${taskId},${userId},${projectId},${taskName},${projectName},${annotationType},"${selectedFolderPaths.join(';')}",${createdAt}\n`;

  try {
    // Write task to tasks.csv
    fs.appendFileSync(tasksFilePath, line);

    // Process team access permissions if provided
    if (teamAccess && Object.keys(teamAccess).length > 0) {
      let accessEntries = '';
      const timestamp = new Date().toISOString();

      // Add project owner as editor by default
      accessEntries += `${taskId},${userId},editor,${userId},${timestamp}\n`;

      // Add team access for other members
      Object.entries(teamAccess).forEach(([memberId, accessLevel]) => {
        accessEntries += `${taskId},${memberId},${accessLevel},${userId},${timestamp}\n`;
      });

      fs.appendFileSync(taskAccessFilePath, accessEntries);

      // Send notifications to team members
      Object.entries(teamAccess).forEach(async ([memberId, accessLevel]) => {
        if (accessLevel !== 'no_access') {
          // Get project owner's username
          const usersFilePath = path.join(__dirname, 'users.csv');
          let ownerUsername = "A team member";

          if (fs.existsSync(usersFilePath)) {
            const usersContent = fs.readFileSync(usersFilePath, 'utf8');
            const userLines = usersContent.trim().split('\n').slice(1);

            const ownerLine = userLines.find(line => {
              const parts = line.split(',');
              return parts[0] === userId;
            });

            if (ownerLine) {
              ownerUsername = ownerLine.split(',')[1];
            }
          }

          const notificationId = uuidv4();
          const message = `${ownerUsername} gave you ${accessLevel} access to task "${taskName}"`;

          const notificationLine = `${notificationId},${memberId},${message},false,${projectId},${timestamp}\n`;
          fs.appendFileSync(notificationsFilePath, notificationLine);
        }
      });
    } else {
      // If no explicit access is provided, add the project owner as editor
      const timestamp = new Date().toISOString();
      fs.appendFileSync(taskAccessFilePath, `${taskId},${userId},editor,${userId},${timestamp}\n`);
    }

    res.json({ taskId, message: "Task created successfully" });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET tasks endpoint to list all tasks from tasks.csv
app.get('/api/tasks', (req, res) => {
  try {
    if (!fs.existsSync(tasksFilePath)) return res.json([]);

    // Get userId from query
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const content = fs.readFileSync(tasksFilePath, 'utf8');
    // Split into lines and skip header
    const lines = content.trim().split('\n').slice(1);

    // Parse all tasks
    const allTasks = lines.map(line => {
      // Split on commas not inside quotes
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return {
        task_id: parts[0],
        user_id: parts[1],
        project_id: parts[2],
        task_name: parts[3],
        project_name: parts[4],
        annotation_type: parts[5],
        selected_files: parts[6].replace(/^"|"$/g, ""),
        created_at: parts[7]
      };
    });

    // Filter tasks based on access
    let accessibleTasks = [];

    // Tasks created by this user are always accessible
    const ownTasks = allTasks.filter(task => task.user_id === userId);
    accessibleTasks = [...ownTasks];

    // Check task_access.csv for other tasks this user has access to
    if (fs.existsSync(taskAccessFilePath)) {
      const accessContent = fs.readFileSync(taskAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      const userAccess = {};

      // Build a map of taskId -> accessLevel for this user
      accessLines.forEach(line => {
        const [task_id, user_id, access_level] = line.split(',');
        if (user_id === userId) {
          userAccess[task_id] = access_level;
        }
      });

      // Add tasks where user has access (not no_access)
      const otherTasks = allTasks.filter(task =>
        !accessibleTasks.some(t => t.task_id === task.task_id) && // Not already added
        userAccess[task.task_id] &&
        userAccess[task.task_id] !== 'no_access'
      );

      accessibleTasks = [...accessibleTasks, ...otherTasks];

      // Add access_level to each task
      accessibleTasks = accessibleTasks.map(task => {
        // Task creator is always editor
        if (task.user_id === userId) {
          return { ...task, access_level: 'editor' };
        }
        // Otherwise use the assigned access level
        return {
          ...task,
          access_level: userAccess[task.task_id] || 'no_access'
        };
      });
    }

    res.json(accessibleTasks);
  } catch (error) {
    console.error("Error reading tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Get task access level for a specific user
app.get('/api/task-access/:taskId/:userId', (req, res) => {
  try {
    const { taskId, userId } = req.params;

    // First check if user is the task creator
    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const taskLines = tasksContent.trim().split('\n').slice(1);

    for (const line of taskLines) {
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts[0] === taskId && parts[1] === userId) {
        // Task creator always has editor access
        return res.json({ access_level: 'editor' });
      }
    }

    // If not the creator, check task_access.csv
    if (fs.existsSync(taskAccessFilePath)) {
      const accessContent = fs.readFileSync(taskAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      for (const line of accessLines) {
        const [task_id, user_id, access_level] = line.split(',');
        if (task_id === taskId && user_id === userId) {
          return res.json({ access_level });
        }
      }
    }

    // Default to no access if not found
    res.json({ access_level: 'no_access' });
  } catch (error) {
    console.error('Error fetching task access:', error);
    res.status(500).json({ error: 'Failed to fetch task access' });
  }
});

// Bulk update task access levels
// Modified server endpoint to fix permission checking logic

app.put('/api/task-access/:taskId/bulk-update', (req, res) => {
  try {
    const { taskId } = req.params;
    const { accessLevels, assignedBy } = req.body;

    if (!taskId || !assignedBy || !accessLevels || typeof accessLevels !== 'object') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First, verify the task exists
    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const taskLines = tasksContent.trim().split('\n').slice(1);

    let taskExists = false;
    let taskData = null;

    for (const line of taskLines) {
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts[0] === taskId) {
        taskExists = true;
        taskData = {
          task_id: parts[0],
          user_id: parts[1],
          project_id: parts[2],
          task_name: parts[3]
        };
        break;
      }
    }

    if (!taskExists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user has permission to update access
    if (taskData.user_id !== assignedBy) {
      // Check if user has editor access
      const accessContent = fs.readFileSync(taskAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      const userAccess = accessLines.find(line => {
        const [task_id, user_id, access_level] = line.split(',');
        return task_id === taskId && user_id === assignedBy;
      });

      // Fix: Properly check if the user has editor access
      if (!userAccess || userAccess.split(',')[2] !== 'editor') {
        return res.status(403).json({ error: 'You do not have permission to update access levels' });
      }
    }

    // Read current access levels
    let existingAccess = [];
    if (fs.existsSync(taskAccessFilePath)) {
      const accessContent = fs.readFileSync(taskAccessFilePath, 'utf8');
      existingAccess = accessContent.trim().split('\n');
    }

    // Prepare new content
    const header = existingAccess[0] || 'task_id,user_id,access_level,assigned_by,assigned_at';
    let updatedLines = [header];
    const timestamp = new Date().toISOString();

    // Keep entries for other tasks
    existingAccess.slice(1).forEach(line => {
      const [task_id, user_id, access_level, assigned_by, assigned_at] = line.split(',');
      if (task_id !== taskId) {
        updatedLines.push(line);
      }
    });

    // Add updated access levels
    Object.entries(accessLevels).forEach(([userId, accessLevel]) => {
      if (['editor', 'viewer', 'no_access'].includes(accessLevel)) {
        updatedLines.push(`${taskId},${userId},${accessLevel},${assignedBy},${timestamp}`);
      }
    });

    // Write updated access levels back to file
    fs.writeFileSync(taskAccessFilePath, updatedLines.join('\n') + '\n');

    // Create notifications for users whose access level changed
    const notificationsToAdd = [];
    const userIdsToNotify = new Set();

    // Get original access levels to compare
    const originalAccess = {};
    existingAccess.slice(1).forEach(line => {
      const [task_id, user_id, access_level] = line.split(',');
      if (task_id === taskId) {
        originalAccess[user_id] = access_level;
      }
    });

    // Get username of the person who assigned the access
    let assignerUsername = "A team member";
    const usersFilePath = path.join(__dirname, 'users.csv');

    if (fs.existsSync(usersFilePath)) {
      const usersContent = fs.readFileSync(usersFilePath, 'utf8');
      const userLines = usersContent.trim().split('\n').slice(1);

      const assignerUser = userLines.find(line => {
        const [id] = line.split(',');
        return id === assignedBy;
      });

      if (assignerUser) {
        assignerUsername = assignerUser.split(',')[1];
      }
    }

    // Check which users' access has changed
    Object.entries(accessLevels).forEach(([userId, newAccessLevel]) => {
      const oldAccessLevel = originalAccess[userId] || 'no_access';

      if (newAccessLevel !== oldAccessLevel && newAccessLevel !== 'no_access') {
        userIdsToNotify.add(userId);

        const notificationId = uuidv4();
        const message = `${assignerUsername} gave you ${newAccessLevel} access to task "${taskData.task_name}"`;

        notificationsToAdd.push(
          `${notificationId},${userId},${message},false,${taskData.project_id},${timestamp}`
        );
      }
    });

    // Add notifications
    if (notificationsToAdd.length > 0) {
      fs.appendFileSync(notificationsFilePath, notificationsToAdd.join('\n') + '\n');
    }

    res.json({
      message: 'Access levels updated successfully',
      updatedCount: Object.keys(accessLevels).length,
      notifiedUsers: Array.from(userIdsToNotify)
    });

  } catch (error) {
    console.error('Error updating task access levels:', error);
    res.status(500).json({ error: 'Failed to update access levels' });
  }
});

// Get project team members for task assignment
app.get('/api/project-team/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    if (!fs.existsSync(rolesFilePath)) {
      return res.json([]);
    }

    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const lines = rolesContent.trim().split('\n').slice(1);

    // Get all users with a role in this project
    const projectRoles = lines.filter(line => {
      const [role_id, project_id, user_id, role_type] = line.split(',');
      return project_id === projectId;
    });

    if (projectRoles.length === 0) {
      return res.json([]);
    }

    // Get user details for each team member
    const usersFilePath = path.join(__dirname, 'users.csv');
    const teamMembers = [];

    if (fs.existsSync(usersFilePath)) {
      const usersContent = fs.readFileSync(usersFilePath, 'utf8');
      const userLines = usersContent.trim().split('\n').slice(1);

      for (const roleLine of projectRoles) {
        const [role_id, project_id, user_id, role_type] = roleLine.split(',');

        const userLine = userLines.find(line => {
          const [id] = line.split(',');
          return id === user_id;
        });

        if (userLine) {
          const [id, username, email] = userLine.split(',');
          teamMembers.push({
            user_id: id,
            username,
            email,
            role_type
          });
        }
      }
    }

    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching project team:', error);
    res.status(500).json({ error: 'Failed to fetch project team' });
  }
});

// image for tasks card
app.get('/api/first-image', (req, res) => {
  const folderPath = req.query.folderPath; // e.g. "61c36569-7d69-4654-8516-22d40d4b24a6/test_imag3"
  if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
  const basePath = path.join(__dirname, 'uploads', folderPath);
  if (!fs.existsSync(basePath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  function findFirstImage(dir) {
    const items = fs.readdirSync(dir);
    for (let item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (imageExtensions.includes(ext)) {
          return item; // Return the file name
        }
      } else if (stat.isDirectory()) {
        const found = findFirstImage(fullPath);
        if (found) return path.join(item, found);
      }
    }
    return null;
  }
  const imageFile = findFirstImage(basePath);
  if (imageFile) {
    return res.json({ imageUrl: `uploads/${folderPath}/${imageFile}` });
  } else {
    return res.status(404).json({ error: 'No image found in folder' });
  }
});

// Create role assignments
app.post('/api/roles', (req, res) => {
  try {
    const { projectId, ownerId, dataProviderId, collaboratorId } = req.body;
    const timestamp = new Date().toISOString();
    let roleLines = '';

    // First, check if roles already exist to avoid duplicates
    let existingRoles = [];
    if (fs.existsSync(rolesFilePath)) {
      const content = fs.readFileSync(rolesFilePath, 'utf8');
      existingRoles = content.trim().split('\n').slice(1);
    }

    // Helper to check if a role already exists
    const roleExists = (pid, uid, roleType) => {
      return existingRoles.some(line => {
        const [, p_id, u_id, r_type] = line.split(',');
        return p_id === pid && u_id === uid && r_type === roleType;
      });
    };

    // Create owner role if it doesn't exist
    if (!roleExists(projectId, ownerId, 'project_owner')) {
      const ownerRoleId = uuidv4();
      roleLines += `${ownerRoleId},${projectId},${ownerId},project_owner,system,${timestamp}\n`;
    }

    // Create data provider role if provided and doesn't exist
    if (dataProviderId && !roleExists(projectId, dataProviderId, 'data_provider')) {
      const dataProviderRoleId = uuidv4();
      roleLines += `${dataProviderRoleId},${projectId},${dataProviderId},data_provider,${ownerId},${timestamp}\n`;
    }

    // Create collaborator role if provided and doesn't exist
    if (collaboratorId && !roleExists(projectId, collaboratorId, 'collaborator')) {
      const collaboratorRoleId = uuidv4();
      roleLines += `${collaboratorRoleId},${projectId},${collaboratorId},collaborator,${ownerId},${timestamp}\n`;
    }

    // Only write to file if we have new roles to add
    if (roleLines) {
      fs.appendFileSync(rolesFilePath, roleLines);
    }

    res.json({ message: 'Roles assigned successfully' });
  } catch (error) {
    console.error('Error assigning roles:', error);
    res.status(500).json({ error: 'Failed to assign roles' });
  }
});

// Get user's role for a specific project
app.get('/api/project-role/:projectId/:userId', (req, res) => {
  try {
    const { projectId, userId } = req.params;

    if (!fs.existsSync(rolesFilePath)) {
      return res.json({ role: null });
    }

    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const lines = rolesContent.trim().split('\n').slice(1);

    for (const line of lines) {
      const [role_id, project_id, user_id, role_type, assigned_by, assigned_at] = line.split(',');

      if (project_id === projectId && user_id === userId) {
        return res.json({ role: role_type });
      }
    }

    res.json({ role: null });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Get all projects a user has access to and their roles
app.get('/api/user-projects/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    if (!fs.existsSync(rolesFilePath) || !fs.existsSync(projectsFilePath)) {
      return res.json({ projects: [], roles: {} });
    }

    // Read user roles from roles.csv
    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const roleLines = rolesContent.trim().split('\n').slice(1);

    // Filter roles for this user
    const userRoles = roleLines
      .filter(line => {
        const parts = line.split(',');
        return parts[2] === userId;
      })
      .reduce((acc, line) => {
        const [role_id, project_id, user_id, role_type] = line.split(',');
        acc[project_id] = role_type;
        return acc;
      }, {});

    // Get all project IDs this user has a role for
    const projectIds = Object.keys(userRoles);

    if (projectIds.length === 0) {
      return res.json({ projects: [], roles: {} });
    }

    // Read projects
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    // Filter projects by project IDs
    const projects = projectLines
      .filter(line => {
        const project_id = line.split(',')[0];
        return projectIds.includes(project_id);
      })
      .map(line => {
        const [project_id, user_id, project_name, project_type, label_classes, folder_path, created_at, hasData] = line.split(',');
        return {
          project_id,
          user_id,
          project_name,
          project_type,
          label_classes: JSON.parse(label_classes.replace(/\|/g, ',')),
          folder_path,
          created_at,
          hasData: hasData === 'true'
        };
      });

    // Find thumbnail images
    projects.forEach(proj => {
      const projectDir = path.join(__dirname, proj.folder_path);

      const findFirstImage = (dir) => {
        if (!fs.existsSync(dir)) return null;

        const items = fs.readdirSync(dir);

        const imageFile = items.find(item => {
          const fullPath = path.join(dir, item);
          const isFile = fs.statSync(fullPath).isFile();
          const ext = path.extname(item).toLowerCase();
          return isFile && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
        });

        if (imageFile) {
          return path.relative(projectDir, path.join(dir, imageFile))
            .replace(/\\/g, '/');
        }

        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findFirstImage(fullPath);
            if (found) return found;
          }
        }

        return null;
      };

      const relativePath = findFirstImage(projectDir);
      if (relativePath) {
        proj.thumbnailImage = `http://localhost:${PORT}/${proj.folder_path}/${relativePath}`;
      }
    });

    res.json({ projects, roles: userRoles });
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ error: 'Failed to fetch user projects' });
  }
});

// Create notifications endpoint
app.post('/api/notifications', (req, res) => {
  try {
    const { userId, message, related_project_id } = req.body;

    const notificationId = uuidv4();
    const createdAt = new Date().toISOString();
    const isRead = false;

    const notificationLine = `${notificationId},${userId},${message},${isRead},${related_project_id || ''},${createdAt}\n`;

    fs.appendFileSync(notificationsFilePath, notificationLine);

    res.json({
      notificationId,
      message: 'Notification created successfully'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Send notifications when data is uploaded
app.post('/api/notifications/data-upload', (req, res) => {
  try {
    const { projectId, uploader, projectName } = req.body;

    // Read roles to find project owner and collaborators
    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const roleLines = rolesContent.trim().split('\n').slice(1);

    const projectRoles = roleLines.filter(line => {
      const parts = line.split(',');
      return parts[1] === projectId;
    });

    let notifications = '';
    const timestamp = new Date().toISOString();

    // Create a notification for project owner and collaborators
    projectRoles.forEach(roleLine => {
      const [role_id, project_id, user_id, role_type] = roleLine.split(',');

      if (role_type === 'project_owner' || role_type === 'collaborator') {
        const notificationId = uuidv4();
        const message = `${uploader} uploaded data to project "${projectName}"`;

        notifications += `${notificationId},${user_id},${message},false,${projectId},${timestamp}\n`;
      }
    });

    if (notifications) {
      fs.appendFileSync(notificationsFilePath, notifications);
    }

    res.json({ message: 'Data upload notifications sent' });
  } catch (error) {
    console.error('Error sending data upload notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Get notifications for a user
app.get('/api/notifications/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    if (!fs.existsSync(notificationsFilePath)) {
      return res.json([]);
    }

    const notificationsContent = fs.readFileSync(notificationsFilePath, 'utf8');
    const lines = notificationsContent.trim().split('\n').slice(1);

    const notifications = lines
      .filter(line => {
        const parts = line.split(',');
        return parts[1] === userId;
      })
      .map(line => {
        const [notification_id, user_id, message, is_read, related_project_id, created_at] = line.split(',');
        return {
          notification_id,
          user_id,
          message,
          is_read: is_read === 'true',
          related_project_id: related_project_id || null,
          created_at
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort by newest first

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.put('/api/notifications/:notificationId', (req, res) => {
  try {
    const { notificationId } = req.params;

    const notificationsContent = fs.readFileSync(notificationsFilePath, 'utf8');
    const lines = notificationsContent.trim().split('\n');
    const header = lines[0];

    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // Keep header

      const parts = line.split(',');
      if (parts[0] === notificationId) {
        // Set is_read to true (index 3)
        parts[3] = 'true';
        return parts.join(',');
      }
      return line;
    });

    fs.writeFileSync(notificationsFilePath, updatedLines.join('\n') + '\n');

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get all users (for validating emails when assigning roles)
app.get('/api/users', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'users.csv');

    if (!fs.existsSync(filePath)) {
      return res.json([]);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const users = fileContent
      .trim()
      .split('\n')
      .map((line) => {
        const [id, username, email, password] = line.split(',');
        // Don't include password in the response
        return { id, username, email };
      });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/annotations', (req, res) => {
  try {
    const { folderId, taskId, taskName, labelClasses, annotations } = req.body;
    const configDir = path.join(__dirname, 'uploads', folderId, 'annotation-config', taskId);
    fs.mkdirSync(configDir, { recursive: true });
    const annotationsPath = path.join(configDir, 'annotations.json');

    fs.writeFileSync(annotationsPath, JSON.stringify({
      taskName,
      labelClasses,
      annotations,
      lastUpdated: new Date().toISOString()
    }, null, 2));

    console.log('Annotations saved to', annotationsPath);
    res.json({ message: 'Annotations saved' });
  } catch (error) {
    console.error('Error saving annotations:', error);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});

app.get('/api/annotations/:folderId/:taskId', (req, res) => {
  const { folderId, taskId } = req.params;
  const annotationsPath = path.join(__dirname, 'uploads', folderId, 'annotation-config', taskId, 'annotations.json');
  if (fs.existsSync(annotationsPath)) {
    const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
    res.json(data);
  } else {
    res.json({ annotations: {} });
  }
});

// User authentication endpoints
app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;
  const user = { id: Date.now().toString(), username, email, password };
  const csvLine = `${user.id},${user.username},${user.email},${user.password}\n`;

  const filePath = path.join(__dirname, 'users.csv');

  fs.appendFile(filePath, csvLine, (err) => {
    if (err) {
      console.error('Error writing to file', err);
      res.status(500).json({ error: 'Error signing up user' });
    } else {
      console.log('User added to CSV file');
      res.json({ message: 'User signed up successfully' });
    }
  });
});

app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;

  const filePath = path.join(__dirname, 'users.csv');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const users = fileContent
    .trim()
    .split('\n')
    .map((line) => {
      const [id, username, userEmail, userPassword] = line.split(',');
      return { id, username, email: userEmail, password: userPassword };
    });

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// Delete image endpoint accepting subfolder paths
app.delete('/api/images/:folderId/*', (req, res) => {
  const folderId = req.params.folderId;
  const filePathInFolder = req.params[0]; // Everything after :folderId/
  const imagePath = path.join(__dirname, 'uploads', folderId, filePathInFolder);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(imagePath);

    // Remove image from annotations (if needed)
    const annotationsPath = path.join(__dirname, 'uploads', folderId, 'annotation-config', taskId, 'annotations.json');
    if (fs.existsSync(annotationsPath)) {
      const annotations = JSON.parse(fs.readFileSync(annotationsPath));
      const imageUrl = `http://localhost:${PORT}/uploads/${folderId}/${filePathInFolder}`;
      if (annotations[imageUrl]) {
        delete annotations[imageUrl];
        fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));
      }
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Add images to existing folder endpoint
const addImagesUpload = multer({ storage }).array('files');

// Update the image upload handler in server.js
app.post('/api/images/:folderId', (req, res) => {
  // Configure multer storage specifically for this route
  const uploadStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const folderId = req.params.folderId;

      // Get current user information
      const userData = req.headers.authorization || req.body.userId;
      let username = 'unknown_user';

      // Extract username from request if available
      if (userData) {
        try {
          // If it's a JWT token
          if (userData.startsWith('Bearer ')) {
            // Implement JWT parsing if needed
          }
          // If it's a user ID from form data
          else if (req.body.userId) {
            // Look up username from users.csv
            const usersFilePath = path.join(__dirname, 'users.csv');
            if (fs.existsSync(usersFilePath)) {
              const usersContent = fs.readFileSync(usersFilePath, 'utf8');
              const userLines = usersContent.trim().split('\n').slice(1);
              const userLine = userLines.find(line => {
                const [id] = line.split(',');
                return id === req.body.userId;
              });
              if (userLine) {
                const [id, name] = userLine.split(',');
                username = name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder name
              }
            }
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }

      // Create user-specific subfolder inside the folderId folder
      const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Check if this is a file from folder upload by checking webkitRelativePath
      if (file.webkitRelativePath) {
        const pathParts = file.webkitRelativePath.split('/');

        // If file is directly in the root folder (only 2 parts: folderName/fileName)
        if (pathParts.length === 2) {
          const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, 'roots');
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        } else {
          // Remove the root folder name and the file name
          pathParts.shift(); // Remove root folder name
          pathParts.pop();   // Remove file name
          const relativePath = pathParts.join('/');

          // Create full upload path with user subfolder
          const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, relativePath);
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        }
      } else {
        // For regular file uploads (not from folder structure)
        const uploadPath = path.join(__dirname, 'uploads', folderId, userFolder, 'roots');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      }
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  });

  const upload = multer({ storage: uploadStorage }).array('files');

  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to upload files' });
    }

    const folderId = req.params.folderId;

    // Get current user information (same as above for consistency)
    const userData = req.headers.authorization || req.body.userId;
    let username = 'unknown_user';

    if (userData) {
      try {
        if (userData.startsWith('Bearer ')) {
          // Implement JWT parsing if needed
        } else if (req.body.userId) {
          const usersFilePath = path.join(__dirname, 'users.csv');
          if (fs.existsSync(usersFilePath)) {
            const usersContent = fs.readFileSync(usersFilePath, 'utf8');
            const userLines = usersContent.trim().split('\n').slice(1);
            const userLine = userLines.find(line => {
              const [id] = line.split(',');
              return id === req.body.userId;
            });
            if (userLine) {
              const [id, name] = userLine.split(',');
              username = name.replace(/[^a-zA-Z0-9_-]/g, '_');
            }
          }
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }

    // Create user-specific subfolder inside the folderId folder (same as above)
    const userFolder = username + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const uploadedFiles = req.files.map((f) => {
      // Handle both files and folders by preserving path structure
      let relativePath;
      if (f.webkitRelativePath) {
        relativePath = f.webkitRelativePath;
      } else {
        relativePath = `roots/${f.originalname}`;
      }

      // Include the user folder in the URL path
      return {
        originalname: f.originalname,
        path: relativePath,
        url: `http://localhost:${PORT}/uploads/${folderId}/${userFolder}/${relativePath}`
      };
    });

    res.json({
      files: uploadedFiles,
      message: 'Upload success'
    });
  });
});

// Check if a file exists in a folder
app.get('/api/check-file/:folderId', (req, res) => {
  try {
    const { folderId } = req.params;
    const filename = req.query.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const filePath = path.join(__dirname, 'uploads', folderId, 'roots', filename);
    const exists = fs.existsSync(filePath);

    res.json({ exists });
  } catch (error) {
    console.error('Error checking file existence:', error);
    res.status(500).json({ error: 'Failed to check file existence' });
  }
});

// Get project roles for project members (to display team info)
app.get('/api/project-members/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!fs.existsSync(rolesFilePath)) {
      return res.json([]);
    }

    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const lines = rolesContent.trim().split('\n').slice(1);

    // Filter roles for this project
    const projectRoles = lines.filter(line => {
      const [role_id, project_id, user_id, role_type] = line.split(',');
      return project_id === projectId && role_type !== 'project_owner'; // Exclude project owner
    });

    if (projectRoles.length === 0) {
      return res.json([]);
    }

    // Get user details from users.csv
    const usersFilePath = path.join(__dirname, 'users.csv');
    if (!fs.existsSync(usersFilePath)) {
      return res.json(projectRoles.map(line => {
        const [role_id, project_id, user_id, role_type] = line.split(',');
        return {
          user_id,
          role_type,
          username: 'Unknown',
          email: 'Unknown'
        };
      }));
    }

    const usersContent = fs.readFileSync(usersFilePath, 'utf8');
    const userLines = usersContent.trim().split('\n').slice(1);

    // Map user details to roles
    const teamMembers = projectRoles.map(roleLine => {
      const [role_id, project_id, user_id, role_type] = roleLine.split(',');

      // Find user details
      const userLine = userLines.find(line => {
        const parts = line.split(',');
        return parts[0] === user_id;
      });

      if (userLine) {
        const [id, username, email] = userLine.split(',');
        return {
          user_id,
          role_type,
          username,
          email
        };
      }

      return {
        user_id,
        role_type,
        username: 'Unknown',
        email: 'Unknown'
      };
    });

    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

app.post('/api/project-members', (req, res) => {
  try {
    const {
      projectId,
      projectName,
      ownerId,
      dataProviderEmails,
      collaboratorEmails
    } = req.body;

    if (!projectId || !ownerId) {
      return res.status(400).json({ error: 'Project ID and owner ID are required' });
    }

    const timestamp = new Date().toISOString();
    let roleLines = '';
    let notifications = '';

    // Set to track processed users to avoid duplicates
    const processedUsers = new Set();

    // Get existing roles to avoid duplicates
    let existingRoles = [];
    if (fs.existsSync(rolesFilePath)) {
      const content = fs.readFileSync(rolesFilePath, 'utf8');
      existingRoles = content.trim().split('\n').slice(1);

      // Add existing roles to processed set
      existingRoles.forEach(line => {
        const [, p_id, u_id] = line.split(',');
        if (p_id === projectId) {
          processedUsers.add(`${projectId}-${u_id}`);
        }
      });
    }

    // Helper to get user ID from email
    const getUserIdFromEmail = (email) => {
      const usersFilePath = path.join(__dirname, 'users.csv');
      if (fs.existsSync(usersFilePath)) {
        const usersContent = fs.readFileSync(usersFilePath, 'utf8');
        const userLines = usersContent.trim().split('\n').slice(1);

        const userLine = userLines.find(line => {
          const [, , userEmail] = line.split(',');
          return userEmail === email;
        });

        if (userLine) {
          return userLine.split(',')[0];
        }
      }
      return null;
    };

    // Process data providers
    if (dataProviderEmails && dataProviderEmails.length > 0) {
      for (const email of dataProviderEmails) {
        const userId = getUserIdFromEmail(email);
        if (userId) {
          // Check if already processed to avoid duplicates
          const userKey = `${projectId}-${userId}`;
          if (processedUsers.has(userKey)) continue;

          processedUsers.add(userKey);

          const roleId = uuidv4();
          roleLines += `${roleId},${projectId},${userId},data_provider,${ownerId},${timestamp}\n`;

          // Create notification
          const notificationId = uuidv4();
          const message = `You have been assigned as data provider for project "${projectName}"`;
          notifications += `${notificationId},${userId},${message},false,${projectId},${timestamp}\n`;
        }
      }
    }

    // Process collaborators
    if (collaboratorEmails && collaboratorEmails.length > 0) {
      for (const email of collaboratorEmails) {
        const userId = getUserIdFromEmail(email);
        if (userId) {
          // Check if already processed to avoid duplicates
          const userKey = `${projectId}-${userId}`;
          if (processedUsers.has(userKey)) continue;

          processedUsers.add(userKey);

          const roleId = uuidv4();
          roleLines += `${roleId},${projectId},${userId},collaborator,${ownerId},${timestamp}\n`;

          // Create notification
          const notificationId = uuidv4();
          const message = `You have been assigned as collaborator for project "${projectName}"`;
          notifications += `${notificationId},${userId},${message},false,${projectId},${timestamp}\n`;
        }
      }
    }

    // Only write to files if we have new data
    if (roleLines) {
      fs.appendFileSync(rolesFilePath, roleLines);
    }

    if (notifications) {
      fs.appendFileSync(notificationsFilePath, notifications);
    }

    res.json({
      message: 'Team members added successfully',
      addedCount: roleLines.split('\n').filter(line => line.trim()).length
    });

  } catch (error) {
    console.error('Error adding team members:', error);
    res.status(500).json({ error: 'Failed to add team members' });
  }
});

// Get count of files in a project (to show data status)
app.get('/api/project-file-count/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // First get the project to find the folder path
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    let folderPath = null;
    for (const line of projectLines) {
      const [project_id, user_id, project_name, project_type, label_classes, folder_path] = line.split(',');
      if (project_id === projectId) {
        folderPath = folder_path;
        break;
      }
    }

    if (!folderPath) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Function to count files recursively
    const countFiles = (dir) => {
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
    };

    const fileCount = countFiles(path.join(__dirname, folderPath));

    res.json({ fileCount });
  } catch (error) {
    console.error('Error counting project files:', error);
    res.status(500).json({ error: 'Failed to count project files' });
  }
});

// Delete a role assignment (for removing team members)
app.delete('/api/roles/:roleId', (req, res) => {
  try {
    const { roleId } = req.params;

    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const lines = rolesContent.trim().split('\n');
    const header = lines[0];

    // Filter out the role to be deleted
    const updatedLines = lines.filter((line, index) => {
      if (index === 0) return true; // Keep header

      const parts = line.split(',');
      return parts[0] !== roleId;
    });

    fs.writeFileSync(rolesFilePath, updatedLines.join('\n') + '\n');

    res.json({ message: 'Role removed successfully' });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// Add a new role assignment to an existing project
app.post('/api/roles/add-to-project', (req, res) => {
  try {
    const { projectId, userId, roleType, assignedBy } = req.body;

    if (!projectId || !userId || !roleType || !assignedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already has a role in this project
    const rolesContent = fs.readFileSync(rolesFilePath, 'utf8');
    const lines = rolesContent.trim().split('\n').slice(1);

    const existingRole = lines.some(line => {
      const [role_id, project_id, user_id, role_type] = line.split(',');
      return project_id === projectId && user_id === userId;
    });

    if (existingRole) {
      return res.status(400).json({ error: 'User already has a role in this project' });
    }

    const roleId = uuidv4();
    const timestamp = new Date().toISOString();

    const roleLine = `${roleId},${projectId},${userId},${roleType},${assignedBy},${timestamp}\n`;

    fs.appendFileSync(rolesFilePath, roleLine);

    // Create notification for the user
    const notificationId = uuidv4();
    const message = `You have been assigned as ${roleType.replace('_', ' ')} for project ${projectId}`;

    const notificationLine = `${notificationId},${userId},${message},false,${projectId},${timestamp}\n`;

    fs.appendFileSync(notificationsFilePath, notificationLine);

    res.json({ message: 'Role assigned successfully' });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Create an empty folder for projects with no initial files
app.post('/api/create-empty-folder', (req, res) => {
  try {
    const folderId = uuidv4();
    const uploadPath = path.join(__dirname, 'uploads', folderId, 'roots');

    // Create the empty directory structure
    fs.mkdirSync(uploadPath, { recursive: true });

    res.json({
      folderId,
      message: 'Empty project folder created successfully'
    });
  } catch (error) {
    console.error('Error creating empty folder:', error);
    res.status(500).json({ error: 'Failed to create empty project folder' });
  }
});

// Get data access status
app.get('/api/data-access/:projectId/:userFolder', (req, res) => {
  try {
    const { projectId, userFolder } = req.params;

    if (!fs.existsSync(dataAccessFilePath)) {
      return res.json({ isEnabled: true }); // Default to enabled if file doesn't exist
    }

    const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
    const lines = accessContent.trim().split('\n').slice(1);

    // Find the record for this folder
    const record = lines.find(line => {
      const [record_project_id, folder_id, record_user_folder] = line.split(',');
      return record_project_id === projectId && record_user_folder === userFolder;
    });

    if (!record) {
      return res.json({ isEnabled: true }); // Default to enabled if no record found
    }

    const [, , , is_enabled] = record.split(',');
    return res.json({ isEnabled: is_enabled === 'true' });

  } catch (error) {
    console.error('Error fetching data access state:', error);
    res.status(500).json({ error: 'Failed to fetch data access state' });
  }
});

// Update data access status
app.put('/api/data-access/:projectId/:userFolder', (req, res) => {
  try {
    const { projectId, userFolder } = req.params;
    const { isEnabled } = req.body;

    if (isEnabled === undefined) {
      return res.status(400).json({ error: 'isEnabled value is required' });
    }

    // Get the folder ID from the project record
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    let folderId = null;
    for (const line of projectLines) {
      const [project_id, , , , , folder_path] = line.split(',');
      if (project_id === projectId) {
        const parts = folder_path.split('/');
        folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"
        break;
      }
    }

    if (!folderId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if record exists and update or create as needed
    if (!fs.existsSync(dataAccessFilePath)) {
      fs.writeFileSync(dataAccessFilePath, 'project_id,folder_id,user_folder,is_enabled,updated_at\n');
    }

    const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
    const lines = accessContent.trim().split('\n');
    const header = lines[0];

    const timestamp = new Date().toISOString();
    let updated = false;

    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // Keep header

      const [record_project_id, record_folder_id, record_user_folder, record_is_enabled, record_updated_at] = line.split(',');

      if (record_project_id === projectId && record_user_folder === userFolder) {
        updated = true;
        return `${projectId},${folderId},${userFolder},${isEnabled},${timestamp}`;
      }

      return line;
    });

    // If no record found, add a new one
    if (!updated) {
      updatedLines.push(`${projectId},${folderId},${userFolder},${isEnabled},${timestamp}`);
    }

    fs.writeFileSync(dataAccessFilePath, updatedLines.join('\n') + '\n');

    // Create a symbolic .access_disabled file to help prevent access at file system level
    const folderPath = path.join(__dirname, 'uploads', folderId, userFolder);
    const accessFlagPath = path.join(folderPath, '.access_disabled');

    if (!isEnabled) {
      // Create a marker file indicating access is disabled
      fs.writeFileSync(accessFlagPath, timestamp);
    } else if (fs.existsSync(accessFlagPath)) {
      // Remove the marker file if access is re-enabled
      fs.unlinkSync(accessFlagPath);
    }

    // Broadcast the data change to all connected clients
    broadcastDataChange(projectId);

    res.json({ message: `Data access ${isEnabled ? 'enabled' : 'disabled'} successfully` });

  } catch (error) {
    console.error('Error updating data access state:', error);
    res.status(500).json({ error: 'Failed to update data access state' });
  }
});

// Delete user data
app.delete('/api/data-access/:projectId/:userFolder', (req, res) => {
  try {
    const { projectId, userFolder } = req.params;

    // Get the folder ID from the project record
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    let folderId = null;
    for (const line of projectLines) {
      const [project_id, , , , , folder_path] = line.split(',');
      if (project_id === projectId) {
        const parts = folder_path.split('/');
        folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"
        break;
      }
    }

    if (!folderId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete the user folder
    const folderPath = path.join(__dirname, 'uploads', folderId, userFolder);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'User folder not found' });
    }

    // Function to recursively delete directory
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

    // Delete the folder
    deleteFolderRecursive(folderPath);

    // Update data_access.csv to remove the record
    if (fs.existsSync(dataAccessFilePath)) {
      const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
      const lines = accessContent.trim().split('\n');
      const header = lines[0];

      const updatedLines = lines.filter((line, index) => {
        if (index === 0) return true; // Keep header

        const [record_project_id, , record_user_folder] = line.split(',');
        return !(record_project_id === projectId && record_user_folder === userFolder);
      });

      fs.writeFileSync(dataAccessFilePath, updatedLines.join('\n') + '\n');
    }

    // Broadcast the data change to all connected clients
    broadcastDataChange(projectId);

    res.json({ message: 'User data deleted successfully' });

  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

// Update the endpoint to list user folders within a project
// Updated API endpoint in server.js to filter folders by user ID for data providers
app.get('/api/project-user-data/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.query.userId; // Optional user ID to filter by

    // Get the folder ID from the project record
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    let folderId = null;
    for (const line of projectLines) {
      const [project_id, , , , , folder_path] = line.split(',');
      if (project_id === projectId) {
        const parts = folder_path.split('/');
        folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"
        break;
      }
    }

    if (!folderId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectDir = path.join(__dirname, 'uploads', folderId);

    if (!fs.existsSync(projectDir)) {
      return res.json([]);
    }

    // Read the folder to find user subfolders
    const items = fs.readdirSync(projectDir);

    // Get username for the requesting user if filtering is needed
    let requestingUsername = null;
    if (userId) {
      const usersFilePath = path.join(__dirname, 'users.csv');
      if (fs.existsSync(usersFilePath)) {
        const usersContent = fs.readFileSync(usersFilePath, 'utf8');
        const userLines = usersContent.trim().split('\n').slice(1);
        const userLine = userLines.find(line => {
          const [id] = line.split(',');
          return id === userId;
        });
        if (userLine) {
          const [, username] = userLine.split(',');
          requestingUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize username for folder matching
        }
      }
    }

    let userFolders = items.filter(item => {
      const fullPath = path.join(projectDir, item);
      const isUserFolder = fs.statSync(fullPath).isDirectory() && item.includes('_20'); // Match pattern username_YYYYMMDD

      // If userId is provided (for data providers), only return their own folders
      if (userId && requestingUsername) {
        // Check if this folder belongs to the requesting user
        return isUserFolder && item.startsWith(requestingUsername + '_');
      }

      return isUserFolder;
    });

    // Get access status for each folder
    const accessStatuses = {};
    if (fs.existsSync(dataAccessFilePath)) {
      const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      accessLines.forEach(line => {
        const [record_project_id, , record_user_folder, is_enabled] = line.split(',');
        if (record_project_id === projectId) {
          accessStatuses[record_user_folder] = is_enabled === 'true';
        }
      });
    }

    // Create the response with user information
    const userFolderInfo = userFolders.map(folderName => {
      const parts = folderName.split('_');
      const username = parts[0];
      const uploadDate = parts.length > 1 ? parts[1] : null;

      // Count files
      let fileCount = 0;
      const countFiles = (dir) => {
        if (!fs.existsSync(dir)) return 0;
        const dirItems = fs.readdirSync(dir);
        dirItems.forEach(item => {
          const itemPath = path.join(dir, item);
          if (fs.statSync(itemPath).isDirectory()) {
            fileCount += countFiles(itemPath);
          } else if (fs.statSync(itemPath).isFile() && !item.startsWith('.')) {
            fileCount++;
          }
        });
        return fileCount;
      };

      countFiles(path.join(projectDir, folderName));

      return {
        folderName,
        username,
        uploadDate: uploadDate ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}` : null,
        isEnabled: accessStatuses[folderName] !== undefined ? accessStatuses[folderName] : true,
        fileCount
      };
    });

    res.json(userFolderInfo);

  } catch (error) {
    console.error('Error fetching project user data:', error);
    res.status(500).json({ error: 'Failed to fetch project user data' });
  }
});

app.get('/api/project-files/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const includePaths = req.query.includePaths === 'true'; // Optional: include full path info

    // Get the folder ID from the project record
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const projectLines = projectsContent.trim().split('\n').slice(1);

    let folderId = null;
    let projectPath = '';
    for (const line of projectLines) {
      const [project_id, , , , , folder_path] = line.split(',');
      if (project_id === projectId) {
        projectPath = folder_path;
        const parts = folder_path.split('/');
        folderId = parts[1]; // Extract folder ID from path like "uploads/abcd123"
        break;
      }
    }

    if (!folderId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectDir = path.join(__dirname, 'uploads', folderId);

    if (!fs.existsSync(projectDir)) {
      return res.json({ files: [] });
    }

    // Get list of disabled user folders
    const disabledFolders = [];

    // Check data_access.csv for disabled folders
    if (fs.existsSync(dataAccessFilePath)) {
      const accessContent = fs.readFileSync(dataAccessFilePath, 'utf8');
      const accessLines = accessContent.trim().split('\n').slice(1);

      accessLines.forEach(line => {
        const [record_project_id, , record_user_folder, is_enabled] = line.split(',');
        if (record_project_id === projectId && is_enabled === 'false') {
          disabledFolders.push(record_user_folder);
        }
      });
    }

    // Also check for .access_disabled marker files
    const items = fs.readdirSync(projectDir);
    items.forEach(item => {
      const fullPath = path.join(projectDir, item);
      if (fs.statSync(fullPath).isDirectory() && item.includes('_20')) {
        const accessFlagPath = path.join(fullPath, '.access_disabled');
        if (fs.existsSync(accessFlagPath) && !disabledFolders.includes(item)) {
          disabledFolders.push(item);
        }
      }
    });

    // Function to gather all files (excluding those in disabled folders)
    const getAllFiles = (dir, basePath = '') => {
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
          if (item.includes('_20') && disabledFolders.includes(item)) {
            // Skip this folder and all its contents if it's disabled
            continue;
          }

          // Recursively process subfolders
          results = results.concat(getAllFiles(fullPath, relativePath));
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
                url: `http://localhost:${PORT}/${projectPath}/${relativePath}`
              });
            } else {
              results.push(`http://localhost:${PORT}/${projectPath}/${relativePath}`);
            }
          }
        }
      }

      return results;
    };

    const files = getAllFiles(projectDir);

    res.json({ files, count: files.length });

  } catch (error) {
    console.error('Error fetching project files:', error);
    res.status(500).json({ error: 'Failed to fetch project files' });
  }
});

// Store keypoints configuration
app.post('/api/keypoints-config', (req, res) => {
  try {
    const { folderId, taskId, keypointsData } = req.body;

    if (!folderId || !taskId || !keypointsData) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // Create directory if it doesn't exist
    const configDir = path.join(__dirname, 'uploads', folderId, 'keypoints-config');
    fs.mkdirSync(configDir, { recursive: true });

    // Create file with task ID as name
    const configFilePath = path.join(configDir, `${taskId}.json`);

    // Save the keypoints configuration
    fs.writeFileSync(configFilePath, JSON.stringify(keypointsData, null, 2));

    res.json({ success: true, message: 'Keypoints configuration saved' });
  } catch (error) {
    console.error('Error saving keypoints configuration:', error);
    res.status(500).json({ error: 'Failed to save keypoints configuration' });
  }
});

// Retrieve keypoints configuration
app.get('/api/keypoints-config/:folderId/:taskId', (req, res) => {
  try {
    const { folderId, taskId } = req.params;

    const configFilePath = path.join(__dirname, 'uploads', folderId, 'keypoints-config', `${taskId}.json`);

    if (!fs.existsSync(configFilePath)) {
      return res.status(404).json({ error: 'Keypoints configuration not found' });
    }

    const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

    res.json(configData);
  } catch (error) {
    console.error('Error retrieving keypoints configuration:', error);
    res.status(500).json({ error: 'Failed to retrieve keypoints configuration' });
  }
});

// Add WebSocket server to server.js

// At the top of the file, add:
const WebSocket = require('ws');

// Replace the existing app.listen with:
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Function to broadcast data changes to all connected clients
const broadcastDataChange = (projectId) => {
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
};

// // Start server
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });