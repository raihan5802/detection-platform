const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
    role_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    project_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'projects',
            key: 'project_id'
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
    role_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['project_owner', 'data_provider', 'collaborator']]
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
    tableName: 'roles',
    timestamps: false
});

module.exports = Role;