const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { APPOINTMENT_STATUS, SESSION_TYPE } = require('../utils/constants');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  patientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Patients', key: 'id' }
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Caregivers', key: 'id' }
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Specialties', key: 'id' }
  },
  scheduledDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sessionType: {
    type: DataTypes.ENUM,
    values: Object.values(SESSION_TYPE),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(APPOINTMENT_STATUS),
    defaultValue: APPOINTMENT_STATUS.PENDING
  },
  notes: {
    type: DataTypes.TEXT
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2)
  }
});

module.exports = Appointment;