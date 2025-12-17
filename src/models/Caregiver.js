const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { VERIFICATION_STATUS } = require('../utils/constants');

const Caregiver = sequelize.define('Caregiver', {
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
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  experience: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  qualifications: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  verificationStatus: {
    type: DataTypes.ENUM,
    values: Object.values(VERIFICATION_STATUS),
    defaultValue: VERIFICATION_STATUS.PENDING
  },
  hourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  availability: {
    type: DataTypes.JSON
  },
  bio: {
    type: DataTypes.TEXT
  },
  profileImage: {
    type: DataTypes.STRING
  },
  supportingDocuments: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  appointmentDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    comment: 'Default appointment duration in minutes'
  },
  autoConfirm: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Auto-confirm appointments after payment'
  }
});

module.exports = Caregiver;