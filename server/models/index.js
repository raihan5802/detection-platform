// models/indexedDB.js

const sequelize = require('../config/database');
const User = require('./User');
const Project = require('./Project');
const Task = require('./Task');
const Role = require('./Role');
const Notification = require('./Notification');
const TaskAccess = require('./TaskAccess');
const DataAccess = require('./DataAccess');

// Define relationships between models
const setupAssociations = () => {
    // User - Project relationships
    User.hasMany(Project, { foreignKey: 'user_id' });
    Project.belongsTo(User, { foreignKey: 'user_id' });

    // User - Task relationships
    User.hasMany(Task, { foreignKey: 'user_id' });
    Task.belongsTo(User, { foreignKey: 'user_id' });

    // Project - Task relationships
    Project.hasMany(Task, { foreignKey: 'project_id' });
    Task.belongsTo(Project, { foreignKey: 'project_id' });

    // Role relationships
    Project.hasMany(Role, { foreignKey: 'project_id' });
    Role.belongsTo(Project, { foreignKey: 'project_id' });
    User.hasMany(Role, { foreignKey: 'user_id' });
    Role.belongsTo(User, { foreignKey: 'user_id' });

    // TaskAccess relationships
    Task.hasMany(TaskAccess, { foreignKey: 'task_id' });
    TaskAccess.belongsTo(Task, { foreignKey: 'task_id' });
    User.hasMany(TaskAccess, { foreignKey: 'user_id' });
    TaskAccess.belongsTo(User, { foreignKey: 'user_id' });

    // Notification relationships
    User.hasMany(Notification, { foreignKey: 'user_id' });
    Notification.belongsTo(User, { foreignKey: 'user_id' });
    Project.hasMany(Notification, { foreignKey: 'related_project_id' });
    Notification.belongsTo(Project, { foreignKey: 'related_project_id', as: 'RelatedProject' });

    // DataAccess relationships
    Project.hasMany(DataAccess, { foreignKey: 'project_id' });
    DataAccess.belongsTo(Project, { foreignKey: 'project_id' });
};

// Initialize models and their relationships
const initializeModels = async () => {
    setupAssociations();

    // Sync all models with database
    // WARNING: { force: true } will drop tables if they exist
    // Use only in development/testing
    try {
        await sequelize.sync({ alter: true });
        console.log('All models were synchronized successfully.');
    } catch (error) {
        console.error('Failed to synchronize models:', error);
    }
};

module.exports = {
    sequelize,
    User,
    Project,
    Task,
    Role,
    Notification,
    TaskAccess,
    DataAccess,
    initializeModels
};