const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport(emailConfig);

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject,
      html
    });
    
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

const sendAppointmentConfirmation = async (patientEmail, appointmentDetails) => {
  const subject = 'Appointment Confirmation - Home Care System';
  const html = `
    <h2>Appointment Confirmed</h2>
    <p>Your appointment has been confirmed for ${appointmentDetails.scheduledDate}</p>
    <p>Caregiver: ${appointmentDetails.caregiverName}</p>
    <p>Type: ${appointmentDetails.sessionType}</p>
  `;
  
  return sendEmail(patientEmail, subject, html);
};

const sendStatusAlert = async (recipientEmail, alertDetails) => {
  const subject = `Patient Status Alert - ${alertDetails.severity.toUpperCase()}`;
  const html = `
    <h2>Patient Status Alert</h2>
    <p><strong>Severity:</strong> ${alertDetails.severity}</p>
    <p><strong>Patient:</strong> ${alertDetails.patientName}</p>
    <p><strong>Message:</strong> ${alertDetails.message}</p>
  `;
  
  return sendEmail(recipientEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendStatusAlert
};