const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Caregiver = sequelize.define('Caregiver', {
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
    licenseNumber: DataTypes.STRING,
    yearsOfExperience: DataTypes.INTEGER,
    bio: DataTypes.TEXT,
    hourlyRate: DataTypes.DECIMAL(10, 2),
    availability: DataTypes.JSON,
    verificationStatus: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: 'pending'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      references: { model: 'Users', key: 'id' }
    },
    verifiedAt: DataTypes.DATE,
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    }
  });

  return Caregiver;
};
