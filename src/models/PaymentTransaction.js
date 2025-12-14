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
    references: { model: 'Appointments', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
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
});

module.exports = PaymentTransaction;