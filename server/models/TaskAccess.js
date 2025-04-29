const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskAccess = sequelize.define('TaskAccess', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    task_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'tasks',
            key: 'task_id'
        }
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    access_level: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['editor', 'viewer', 'no_access']]
        }
    },
    assigned_by: {
        type: DataTypes.STRING,
        allowNull: false
    },
    assigned_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'task_access',
    timestamps: false
});

module.exports = TaskAccess;