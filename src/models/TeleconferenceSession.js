const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TeleconferenceSession = sequelize.define('TeleconferenceSession', {
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
    roomName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    startedAt: DataTypes.DATE,
    endedAt: DataTypes.DATE,
    recordingUrl: DataTypes.STRING,
    transcription: DataTypes.TEXT,
    chatHistory: DataTypes.JSON
  });

  return TeleconferenceSession;
};
