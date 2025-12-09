const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Appointment = sequelize.define('Appointment', {
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
    caregiverId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Caregivers', key: 'id' }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 60
    },
    type: {
      type: DataTypes.ENUM('in-person', 'teleconference'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    notes: DataTypes.TEXT,
    location: DataTypes.STRING
  });

  return Appointment;
};
