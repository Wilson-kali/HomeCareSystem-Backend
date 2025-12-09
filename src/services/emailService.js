const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');

const transporter = nodemailer.createTransport(emailConfig);

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text
    });
    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
};

const sendAppointmentConfirmation = async (appointment, patient, caregiver) => {
  const html = `
    <h2>Appointment Confirmed</h2>
    <p>Your appointment has been scheduled for ${appointment.scheduledAt}</p>
    <p>Caregiver: ${caregiver.firstName} ${caregiver.lastName}</p>
  `;
  return sendEmail({ to: patient.email, subject: 'Appointment Confirmation', html });
};

const sendStatusAlert = async (patient, status) => {
  const html = `
    <h2>Patient Status Alert</h2>
    <p>Patient ${patient.firstName} ${patient.lastName} status: ${status}</p>
  `;
  return sendEmail({ to: patient.email, subject: 'Status Alert', html });
};

module.exports = { sendEmail, sendAppointmentConfirmation, sendStatusAlert };
