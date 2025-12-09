const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  pool: dbConfig.pool
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./User')(sequelize);
db.Patient = require('./Patient')(sequelize);
db.Specialty = require('./Specialty')(sequelize);
db.Caregiver = require('./Caregiver')(sequelize);
db.PrimaryPhysician = require('./PrimaryPhysician')(sequelize);
db.Appointment = require('./Appointment')(sequelize);
db.TeleconferenceSession = require('./TeleconferenceSession')(sequelize);
db.CareSessionReport = require('./CareSessionReport')(sequelize);
db.PaymentTransaction = require('./PaymentTransaction')(sequelize);
db.CaregiverRecommendation = require('./CaregiverRecommendation')(sequelize);
db.StatusAlert = require('./StatusAlert')(sequelize);

// Associations
db.User.hasOne(db.Patient, { foreignKey: 'userId' });
db.Patient.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasOne(db.Caregiver, { foreignKey: 'userId' });
db.Caregiver.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasOne(db.PrimaryPhysician, { foreignKey: 'userId' });
db.PrimaryPhysician.belongsTo(db.User, { foreignKey: 'userId' });

db.Caregiver.belongsToMany(db.Specialty, { through: 'CaregiverSpecialties' });
db.Specialty.belongsToMany(db.Caregiver, { through: 'CaregiverSpecialties' });

db.Appointment.belongsTo(db.Patient, { foreignKey: 'patientId' });
db.Appointment.belongsTo(db.Caregiver, { foreignKey: 'caregiverId' });

db.TeleconferenceSession.belongsTo(db.Appointment, { foreignKey: 'appointmentId' });

db.CareSessionReport.belongsTo(db.Appointment, { foreignKey: 'appointmentId' });
db.CareSessionReport.belongsTo(db.Caregiver, { foreignKey: 'caregiverId' });
db.CareSessionReport.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.PaymentTransaction.belongsTo(db.Appointment, { foreignKey: 'appointmentId' });
db.PaymentTransaction.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.CaregiverRecommendation.belongsTo(db.PrimaryPhysician, { foreignKey: 'physicianId' });
db.CaregiverRecommendation.belongsTo(db.Patient, { foreignKey: 'patientId' });
db.CaregiverRecommendation.belongsTo(db.Caregiver, { foreignKey: 'caregiverId' });
db.CaregiverRecommendation.belongsTo(db.Specialty, { foreignKey: 'specialtyId' });

db.StatusAlert.belongsTo(db.Patient, { foreignKey: 'patientId' });
db.StatusAlert.belongsTo(db.CareSessionReport, { foreignKey: 'reportId' });

module.exports = db;
