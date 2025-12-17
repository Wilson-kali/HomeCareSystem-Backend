const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { TIMESLOT_STATUS } = require('../utils/constants');

const TimeSlot = sequelize.define('TimeSlot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Caregivers',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Duration in minutes'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(TIMESLOT_STATUS),
    defaultValue: TIMESLOT_STATUS.AVAILABLE
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Slot locked until this time for payment processing'
  },
  isBooked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  appointmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Appointments',
      key: 'id'
    }
  }
}, {
  tableName: 'time_slots',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['caregiverId', 'date', 'startTime']
    }
  ]
});

module.exports = TimeSlot;