-- Complete PostgreSQL Schema for Annotation Platform

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS keypoints_config;
DROP TABLE IF EXISTS annotation_status;
DROP TABLE IF EXISTS folder_creation;
DROP TABLE IF EXISTS file_deletions;
DROP TABLE IF EXISTS file_uploads;
DROP TABLE IF EXISTS data_access;
DROP TABLE IF EXISTS task_access;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE projects (
  project_id VARCHAR(36) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) NOT NULL,
  label_classes JSONB DEFAULT '[]',
  folder_path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  has_data BOOLEAN DEFAULT FALSE
);

-- Create tasks table
CREATE TABLE tasks (
  task_id VARCHAR(36) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(36) REFERENCES projects(project_id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  annotation_type VARCHAR(50) NOT NULL,
  selected_files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE roles (
  role_id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('project_owner', 'data_provider', 'collaborator')),
  assigned_by VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_project_user_role UNIQUE (project_id, user_id, role_type)
);

-- Create notifications table
CREATE TABLE notifications (
  notification_id VARCHAR(36) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_project_id VARCHAR(36) REFERENCES projects(project_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create task_access table
CREATE TABLE task_access (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_level VARCHAR(50) NOT NULL CHECK (access_level IN ('editor', 'viewer', 'no_access')),
  assigned_by VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_access_task_id_user_id_key UNIQUE (task_id, user_id)
);

-- Create data_access table
CREATE TABLE data_access (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(36) REFERENCES projects(project_id) ON DELETE CASCADE,
  folder_id VARCHAR(100) NOT NULL,
  user_folder VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT data_access_project_id_user_folder_key UNIQUE (project_id, user_folder)
);

-- Create file_uploads table to track uploaded files
CREATE TABLE file_uploads (
  id SERIAL PRIMARY KEY,
  folder_id VARCHAR(100) NOT NULL,
  user_folder VARCHAR(255),
  file_count INTEGER NOT NULL,
  files_json JSONB NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create file_deletions table to track deleted files
CREATE TABLE file_deletions (
  id SERIAL PRIMARY KEY,
  folder_id VARCHAR(100) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  deletion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create folder_creation table to track created folders
CREATE TABLE folder_creation (
  id SERIAL PRIMARY KEY,
  folder_id VARCHAR(100) NOT NULL UNIQUE,
  creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create annotation_status table to track annotation updates
CREATE TABLE annotation_status (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
  folder_id VARCHAR(100) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_task_folder UNIQUE (task_id, folder_id)
);

-- Create keypoints_config table to store keypoints configurations
CREATE TABLE keypoints_config (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
  folder_id VARCHAR(100) NOT NULL, 
  config_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_keypoints_config UNIQUE (task_id, folder_id)
);

-- Add indexes for better performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_folder_path ON projects(folder_path);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_roles_project_id ON roles(project_id);
CREATE INDEX idx_roles_user_id ON roles(user_id);
CREATE INDEX idx_roles_project_user ON roles(project_id, user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_related_project_id ON notifications(related_project_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_task_access_task_id ON task_access(task_id);
CREATE INDEX idx_task_access_user_id ON task_access(user_id);
CREATE INDEX idx_task_access_task_user ON task_access(task_id, user_id);
CREATE INDEX idx_data_access_project_id ON data_access(project_id);
CREATE INDEX idx_data_access_folder_id ON data_access(folder_id);
CREATE INDEX idx_data_access_user_folder ON data_access(user_folder);
CREATE INDEX idx_file_uploads_folder_id ON file_uploads(folder_id);
CREATE INDEX idx_file_uploads_upload_date ON file_uploads(upload_date);
CREATE INDEX idx_file_deletions_folder_id ON file_deletions(folder_id);
CREATE INDEX idx_annotation_status_task_id ON annotation_status(task_id);
CREATE INDEX idx_annotation_status_folder_id ON annotation_status(folder_id);
CREATE INDEX idx_keypoints_config_task_id ON keypoints_config(task_id);
CREATE INDEX idx_keypoints_config_folder_id ON keypoints_config(folder_id);

-- Add comments to describe tables and important columns
COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON TABLE projects IS 'Stores project metadata including label classes';
COMMENT ON TABLE tasks IS 'Stores annotation tasks associated with projects';
COMMENT ON TABLE roles IS 'Stores user roles for projects (owner, collaborator, data_provider)';
COMMENT ON TABLE notifications IS 'Stores user notifications for various system events';
COMMENT ON TABLE task_access IS 'Stores user access levels for specific tasks';
COMMENT ON TABLE data_access IS 'Controls access to uploaded data folders';
COMMENT ON TABLE file_uploads IS 'Tracks file upload operations';
COMMENT ON TABLE file_deletions IS 'Tracks file deletion operations';
COMMENT ON TABLE folder_creation IS 'Tracks folder creation operations';
COMMENT ON TABLE annotation_status IS 'Tracks the status of annotations for tasks and folders';
COMMENT ON TABLE keypoints_config IS 'Stores keypoints configurations for tasks';

COMMENT ON COLUMN projects.label_classes IS 'JSON array of label class objects';
COMMENT ON COLUMN tasks.selected_files IS 'JSON array of selected folder paths';
COMMENT ON COLUMN roles.role_type IS 'Type of role: project_owner, collaborator, data_provider';
COMMENT ON COLUMN task_access.access_level IS 'Access level: editor, viewer, no_access';
COMMENT ON COLUMN notifications.is_read IS 'Indicates if the user has marked the notification as read';
COMMENT ON COLUMN data_access.is_enabled IS 'Controls whether folder is accessible to users';
COMMENT ON COLUMN file_uploads.files_json IS 'JSON array of uploaded file information';
COMMENT ON COLUMN annotation_status.last_updated IS 'When the annotations were last saved';
COMMENT ON COLUMN annotation_status.last_accessed IS 'When the annotations were last viewed';
COMMENT ON COLUMN keypoints_config.config_json IS 'JSON representation of keypoints configuration';