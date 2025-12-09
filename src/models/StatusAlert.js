const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StatusAlert = sequelize.define('StatusAlert', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Patients', key: 'id' }
    },
    reportId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'CareSessionReports', key: 'id' }
    },
    alertType: {
      type: DataTypes.ENUM('deteriorating', 'critical', 'deceased'),
      allowNull: false
    },
    message: DataTypes.TEXT,
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    notifiedUsers: DataTypes.JSON
  });

  return StatusAlert;
};
