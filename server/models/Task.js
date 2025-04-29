const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
    task_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    project_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'projects',
            key: 'project_id'
        }
    },
    task_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    project_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    annotation_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    selected_files: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'tasks',
    timestamps: false
});

module.exports = Task;