const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
    project_id: {
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
    project_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    project_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    label_classes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    folder_path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    has_data: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'projects',
    timestamps: false
});

module.exports = Project;