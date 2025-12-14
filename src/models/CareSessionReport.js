const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PATIENT_STATUS } = require('../utils/constants');

const CareSessionReport = sequelize.define('CareSessionReport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  appointmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Appointments', key: 'id' }
  },
  observations: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  interventions: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  vitals: {
    type: DataTypes.JSON
  },
  patientStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PATIENT_STATUS),
    allowNull: false
  },
  sessionSummary: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  recommendations: {
    type: DataTypes.TEXT
  },
  followUpRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  attachments: {
    type: DataTypes.JSON
  }
});

module.exports = CareSessionReport;