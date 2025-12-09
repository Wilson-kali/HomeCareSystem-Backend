const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Specialty = sequelize.define('Specialty', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: DataTypes.TEXT,
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  return Specialty;
};
