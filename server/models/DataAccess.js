const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DataAccess = sequelize.define('DataAccess', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    project_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'projects',
            key: 'project_id'
        }
    },
    folder_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_folder: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'data_access',
    timestamps: false
});

module.exports = DataAccess;