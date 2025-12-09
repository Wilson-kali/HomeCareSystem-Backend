const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Patient = sequelize.define('Patient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    dateOfBirth: DataTypes.DATE,
    address: DataTypes.TEXT,
    emergencyContact: DataTypes.STRING,
    medicalHistory: DataTypes.TEXT,
    currentStatus: {
      type: DataTypes.ENUM('stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased'),
      defaultValue: 'stable'
    }
  });

  return Patient;
};
