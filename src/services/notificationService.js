const { StatusAlert } = require('../models');
const { sendStatusAlert: sendStatusEmail } = require('./emailService');
const { sendStatusAlert: sendStatusSMS } = require('./smsService');
const { ALERT_SEVERITY, PATIENT_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

const createStatusAlert = async (patientId, reportId, patientStatus, patientDetails) => {
  try {
    let severity = ALERT_SEVERITY.LOW;
    let message = `Patient status updated to: ${patientStatus}`;

    // Determine severity based on patient status
    switch (patientStatus) {
      case PATIENT_STATUS.DETERIORATING:
        severity = ALERT_SEVERITY.HIGH;
        message = `URGENT: Patient condition is deteriorating and requires immediate attention.`;
        break;
      case PATIENT_STATUS.CRITICAL:
        severity = ALERT_SEVERITY.CRITICAL;
        message = `CRITICAL: Patient is in critical condition. Immediate medical intervention required.`;
        break;
      case PATIENT_STATUS.DECEASED:
        severity = ALERT_SEVERITY.CRITICAL;
        message = `CRITICAL: Patient status updated to deceased. Please follow protocol procedures.`;
        break;
      case PATIENT_STATUS.IMPROVING:
        severity = ALERT_SEVERITY.LOW;
        message = `Good news: Patient condition is improving.`;
        break;
      case PATIENT_STATUS.CURED:
        severity = ALERT_SEVERITY.LOW;
        message = `Patient has recovered successfully.`;
        break;
    }

    const alert = await StatusAlert.create({
      patientId,
      reportId,
      severity,
      message
    });

    // Send notifications for high severity alerts
    if (severity === ALERT_SEVERITY.HIGH || severity === ALERT_SEVERITY.CRITICAL) {
      // Send email alert
      if (patientDetails.emergencyContactEmail) {
        await sendStatusEmail(patientDetails.emergencyContactEmail, {
          severity,
          patientName: patientDetails.name,
          message
        });
      }
      
      // Send SMS alert
      if (patientDetails.emergencyContactPhone) {
        await sendStatusSMS(patientDetails.emergencyContactPhone, {
          severity,
          patientName: patientDetails.name,
          message
        });
      }
    }

    logger.info(`Status alert created for patient ${patientId} with severity ${severity}`);
    return alert;
  } catch (error) {
    logger.error('Failed to create status alert:', error);
    throw error;
  }
};

const markAlertAsRead = async (alertId, userId) => {
  try {
    const alert = await StatusAlert.findByPk(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.isRead = true;
    alert.readAt = new Date();
    await alert.save();

    return alert;
  } catch (error) {
    logger.error('Failed to mark alert as read:', error);
    throw error;
  }
};

module.exports = {
  createStatusAlert,
  markAlertAsRead
};