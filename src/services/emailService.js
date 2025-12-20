const { Resend } = require('resend');
const logger = require('../utils/logger');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    console.log('🔄 Attempting to send email...');
    console.log('📧 To:', to);
    console.log('📝 Subject:', subject);
    console.log('🔑 API Key exists:', !!process.env.RESEND_API_KEY);
    console.log('📤 From:', `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`);

    const { data, error } = await resend.emails.send({
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
      to: [to],
      subject,
      html
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      throw error;
    }

    console.log('✅ Email sent successfully!');
    console.log('📨 Email ID:', data.id);
    logger.info(`Email sent: ${data.id}`);
    return data;
  } catch (error) {
    console.error('💥 Email sending failed:', error);
    logger.error('Email sending failed:', error);
    throw error;
  }
};

const sendAppointmentConfirmation = async (patientEmail, appointmentDetails) => {
  const subject = 'Appointment Confirmation - Home Care System';
  const formattedDate = new Date(appointmentDetails.scheduledDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .details { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Appointment Confirmed</h1>
        </div>
        <div class="content">
          <p>Dear Patient,</p>
          <p>Your appointment has been successfully confirmed. Here are the details:</p>

          <div class="details">
            <div class="detail-row">
              <strong>Date & Time:</strong>
              <span>${formattedDate}</span>
            </div>
            <div class="detail-row">
              <strong>Caregiver:</strong>
              <span>${appointmentDetails.caregiverName}</span>
            </div>
            <div class="detail-row">
              <strong>Session Type:</strong>
              <span>${appointmentDetails.sessionType === 'in_person' ? 'In-Person Visit' : 'Teleconference'}</span>
            </div>
            ${appointmentDetails.duration ? `
            <div class="detail-row">
              <strong>Duration:</strong>
              <span>${appointmentDetails.duration} minutes</span>
            </div>
            ` : ''}
          </div>

          <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/appointments" class="button">View Appointment</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Care System. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendStatusAlert = async (recipientEmail, alertDetails) => {
  const subject = `Patient Status Alert - ${alertDetails.severity.toUpperCase()}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .alert-box { padding: 20px; border: 2px solid #1a1a1a; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .severity-badge { display: inline-block; padding: 4px 12px; border: 1px solid #1a1a1a; border-radius: 4px; background: #f5f5f5; color: #1a1a1a; font-weight: 600; text-transform: uppercase; font-size: 11px; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Patient Status Alert</h1>
        </div>
        <div class="content">
          <p><strong>URGENT:</strong> A patient status alert has been triggered.</p>

          <div class="alert-box">
            <div class="detail-row">
              <strong>Severity:</strong>
              <span class="severity-badge">${alertDetails.severity}</span>
            </div>
            <div class="detail-row">
              <strong>Patient:</strong>
              <span>${alertDetails.patientName}</span>
            </div>
            <div class="detail-row">
              <strong>Status:</strong>
              <span>${alertDetails.message}</span>
            </div>
            ${alertDetails.reportedBy ? `
            <div class="detail-row">
              <strong>Reported By:</strong>
              <span>${alertDetails.reportedBy}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <strong>Time:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          <p><strong>Action Required:</strong> Please review the patient's condition and take appropriate action immediately.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/reports" class="button">View Care Reports</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Care System. All rights reserved.</p>
          <p>This is an automated alert. For urgent matters, please contact the care team directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendPasswordChangeNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Password Changed - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Changed</h1>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>Your password has been successfully changed on ${new Date().toLocaleDateString()}.</p>
          <p>If you did not make this change, please contact our support team immediately.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverRegistrationNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Registration Received - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Received</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Thank you for registering as a caregiver with ${systemName}. Your application has been successfully received and is currently under review.</p>
          <p>Our administrative team will review your credentials and qualifications. You will receive an email notification once your account has been approved.</p>
          <p>This process typically takes 1-2 business days. We appreciate your patience.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverApprovalNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Account Approved - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Congratulations! Your caregiver account has been approved and activated.</p>
          <p>You can now log in to your account and start providing care services through ${systemName}.</p>
          <p>Welcome to our healthcare community.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, firstName, resetUrl) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Password Reset Request - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .reset-box { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; text-align: center; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; font-size: 14px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
        .warning { background: #fafafa; border: 1px solid #e5e5e5; padding: 15px; border-radius: 4px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password for your ${systemName} account.</p>

          <div class="reset-box">
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This link will expire in 1 hour for security reasons.
            </p>
          </div>

          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <p style="margin: 8px 0 0 0;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>

          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>

          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendPaymentConfirmation = async (patientEmail, paymentDetails) => {
  const subject = 'Payment Confirmation - Home Care System';
  const formattedDate = new Date(paymentDetails.appointmentDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .payment-box { padding: 20px; border: 2px solid #1a1a1a; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .amount { font-size: 20px; font-weight: 600; color: #1a1a1a; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Payment Confirmed</h1>
        </div>
        <div class="content">
          <p>Dear ${paymentDetails.patientName},</p>
          <p>Your payment has been successfully processed and your appointment is now confirmed!</p>

          <div class="payment-box">
            <div class="detail-row">
              <strong>Amount Paid:</strong>
              <span class="amount">MWK ${paymentDetails.amount}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction ID:</strong>
              <span>${paymentDetails.transactionId}</span>
            </div>
            <div class="detail-row">
              <strong>Payment Date:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <strong>Appointment:</strong>
              <span>${formattedDate}</span>
            </div>
            <div class="detail-row">
              <strong>Caregiver:</strong>
              <span>${paymentDetails.caregiverName}</span>
            </div>
          </div>

          <p>Your appointment is confirmed and the caregiver has been notified. You will receive a reminder 24 hours before your scheduled appointment.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/appointments" class="button">View Appointment</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Care System. All rights reserved.</p>
          <p>Keep this email as your payment receipt.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendStatusAlert,
  sendPasswordChangeNotification,
  sendPasswordResetEmail,
  sendCaregiverRegistrationNotification,
  sendCaregiverApprovalNotification,
  sendPaymentConfirmation
};
