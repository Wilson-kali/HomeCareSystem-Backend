const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CaregiverRecommendation = sequelize.define('CaregiverRecommendation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    physicianId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'PrimaryPhysicians', key: 'id' }
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
    specialtyId: {
      type: DataTypes.UUID,
      references: { model: 'Specialties', key: 'id' }
    },
    reason: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      defaultValue: 'pending'
    }
  });

  return CaregiverRecommendation;
};
