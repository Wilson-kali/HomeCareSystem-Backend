const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PAYMENT_STATUS } = require('../utils/constants');

const PendingPaymentTransaction = sequelize.define('PendingPaymentTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pendingBookingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pending_bookings', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentType: {
    type: DataTypes.ENUM('booking_fee', 'session_fee'),
    allowNull: false,
    defaultValue: 'booking_fee'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'MWK'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'paychangu'
  },
  tx_ref: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING
  },
  paidAt: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.JSON
  },
  convertedToPaymentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of PaymentTransaction after conversion'
  }
}, {
  tableName: 'pending_payment_transactions',
  timestamps: true
});

module.exports = PendingPaymentTransaction;
