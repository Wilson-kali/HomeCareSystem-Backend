const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CareSessionReport = sequelize.define('CareSessionReport', {
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
    caregiverId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Caregivers', key: 'id' }
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Patients', key: 'id' }
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    interventions: DataTypes.TEXT,
    vitals: DataTypes.JSON,
    sessionSummary: DataTypes.TEXT,
    patientStatus: {
      type: DataTypes.ENUM('stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased'),
      allowNull: false
    },
    attachments: DataTypes.JSON
  });

  return CareSessionReport;
};
