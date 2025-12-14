const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  emergencyContact: {
    type: DataTypes.STRING,
    allowNull: false
  },
  medicalHistory: {
    type: DataTypes.TEXT
  },
  currentMedications: {
    type: DataTypes.TEXT
  },
  allergies: {
    type: DataTypes.TEXT
  }
});

module.exports = Patient;