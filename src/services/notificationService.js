const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSMS = async (to, message) => {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });
    return { success: true };
  } catch (error) {
    console.error('SMS error:', error);
    throw error;
  }
};

const sendAppointmentReminder = async (phone, appointmentDetails) => {
  const message = `Reminder: You have an appointment on ${appointmentDetails.scheduledAt}`;
  return sendSMS(phone, message);
};

module.exports = { sendSMS, sendAppointmentReminder };
