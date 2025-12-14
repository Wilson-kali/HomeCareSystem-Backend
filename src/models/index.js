const sequelize = require('../config/database');
const User = require('./User');
const Patient = require('./Patient');
const Caregiver = require('./Caregiver');
const PrimaryPhysician = require('./PrimaryPhysician');
const Specialty = require('./Specialty');
const Appointment = require('./Appointment');
const TeleconferenceSession = require('./TeleconferenceSession');
const CareSessionReport = require('./CareSessionReport');
const PaymentTransaction = require('./PaymentTransaction');
const CaregiverRecommendation = require('./CaregiverRecommendation');
const StatusAlert = require('./StatusAlert');

// Define associations
User.hasOne(Patient, { foreignKey: 'userId' });
Patient.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Caregiver, { foreignKey: 'userId' });
Caregiver.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(PrimaryPhysician, { foreignKey: 'userId' });
PrimaryPhysician.belongsTo(User, { foreignKey: 'userId' });

// Caregiver-Specialty many-to-many
Caregiver.belongsToMany(Specialty, { through: 'CaregiverSpecialties' });
Specialty.belongsToMany(Caregiver, { through: 'CaregiverSpecialties' });

// Appointments
Patient.hasMany(Appointment, { foreignKey: 'patientId' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId' });

Caregiver.hasMany(Appointment, { foreignKey: 'caregiverId' });
Appointment.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// Teleconference sessions
Appointment.hasOne(TeleconferenceSession, { foreignKey: 'appointmentId' });
TeleconferenceSession.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Care session reports
Appointment.hasOne(CareSessionReport, { foreignKey: 'appointmentId' });
CareSessionReport.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Payment transactions
Appointment.hasOne(PaymentTransaction, { foreignKey: 'appointmentId' });
PaymentTransaction.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Caregiver recommendations
PrimaryPhysician.hasMany(CaregiverRecommendation, { foreignKey: 'physicianId' });
CaregiverRecommendation.belongsTo(PrimaryPhysician, { foreignKey: 'physicianId' });

Patient.hasMany(CaregiverRecommendation, { foreignKey: 'patientId' });
CaregiverRecommendation.belongsTo(Patient, { foreignKey: 'patientId' });

Caregiver.hasMany(CaregiverRecommendation, { foreignKey: 'caregiverId' });
CaregiverRecommendation.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// Status alerts
Patient.hasMany(StatusAlert, { foreignKey: 'patientId' });
StatusAlert.belongsTo(Patient, { foreignKey: 'patientId' });

module.exports = {
  sequelize,
  User,
  Patient,
  Caregiver,
  PrimaryPhysician,
  Specialty,
  Appointment,
  TeleconferenceSession,
  CareSessionReport,
  PaymentTransaction,
  CaregiverRecommendation,
  StatusAlert
};