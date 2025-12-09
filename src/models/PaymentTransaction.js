const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PaymentTransaction = sequelize.define('PaymentTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    appointmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Appointments', key: 'id' }
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Patients', key: 'id' }
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
      type: DataTypes.ENUM('card', 'mobile_money', 'bank_transfer'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    transactionId: DataTypes.STRING,
    metadata: DataTypes.JSON
  });

  return PaymentTransaction;
};
