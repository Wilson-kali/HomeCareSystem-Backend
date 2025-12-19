const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PAYMENT_STATUS } = require('../utils/constants');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  appointmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'appointments', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentType: {
    type: DataTypes.ENUM('booking_fee', 'session_fee'),
    allowNull: false,
    defaultValue: 'booking_fee',
    field: 'payment_type',
    comment: 'Type of payment: booking_fee or session_fee'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'MWK'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stripePaymentIntentId: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING
  },
  paidAt: {
    type: DataTypes.DATE
  },
  refundedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'paymenttransactions'
});

module.exports = PaymentTransaction;