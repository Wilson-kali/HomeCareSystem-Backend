const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { APPOINTMENT_STATUS, SESSION_TYPE, PAYMENT_STATUS } = require('../utils/constants');

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
  bookingFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Booking fee amount for this appointment'
  },
  sessionFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Session fee amount for this appointment'
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  timeSlotId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'time_slots',
      key: 'id'
    }
  },
  bookingFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'booking_fee_status',
    comment: 'Payment status for booking fee'
  },
  sessionFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'session_fee_status',
    comment: 'Payment status for session fee'
  },
  paymentStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    comment: 'Overall payment status (deprecated - use bookingFeeStatus and sessionFeeStatus)'
  },
  bookedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sessionPaidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'session_paid_at',
    comment: 'Timestamp when session fee was paid'
  },
  patientFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'patient_feedback',
    comment: 'Patient feedback/comment for this session (admin-only visibility)'
  },
  patientRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'patient_rating',
    validate: {
      min: 1,
      max: 5
    },
    comment: 'Patient rating for this session (1-5 stars)'
  }
});

module.exports = Appointment;