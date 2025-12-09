const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PrimaryPhysician = sequelize.define('PrimaryPhysician', {
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
    licenseNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },
    specialization: DataTypes.STRING,
    hospitalAffiliation: DataTypes.STRING
  });

  return PrimaryPhysician;
};
