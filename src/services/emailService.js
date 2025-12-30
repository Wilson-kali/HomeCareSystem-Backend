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
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/appointments" class="button" style="color: white !important;">View Appointment</a>
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
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/reports" class="button" style="color: white !important;">View Care Reports</a>
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
            <a href="${resetUrl}" class="button" style="color: white !important;">Reset Password</a>
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
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/appointments" class="button" style="color: white !important;">View Appointment</a>
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

const sendPaymentFailureNotification = async (patientEmail, paymentDetails) => {
  const subject = 'Payment Failed - Home Care System';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fff5f5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #d32f2f; }
        .content { padding: 30px 20px; }
        .failure-box { padding: 20px; border: 2px solid #d32f2f; border-radius: 4px; margin: 20px 0; background: #fff5f5; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .amount { font-size: 18px; font-weight: 600; color: #d32f2f; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .info-box { padding: 15px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; background: #fafafa; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✗ Payment Failed</h1>
        </div>
        <div class="content">
          <p>Dear ${paymentDetails.patientName},</p>
          <p>We're sorry, but your payment could not be processed. Your booking has been released and the time slot is now available for others.</p>

          <div class="failure-box">
            <div class="detail-row">
              <strong>Amount:</strong>
              <span class="amount">MWK ${paymentDetails.amount}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction ID:</strong>
              <span>${paymentDetails.tx_ref}</span>
            </div>
            <div class="detail-row">
              <strong>Booking ID:</strong>
              <span>${paymentDetails.bookingId}</span>
            </div>
            <div class="detail-row">
              <strong>Failed At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          <div class="info-box">
            <strong>What happened?</strong>
            <p style="margin: 8px 0 0 0;">Your payment could not be completed. This might be due to insufficient funds, declined card, or a technical issue with the payment provider.</p>
          </div>

          <div class="info-box">
            <strong>What should I do?</strong>
            <p style="margin: 8px 0 0 0;">
              1. Check your payment method and ensure sufficient funds are available<br>
              2. Try booking again with a different payment method<br>
              3. Contact your bank if the issue persists<br>
              4. Reach out to our support team if you need assistance
            </p>
          </div>

          <p>The time slot you selected has been released and is available for rebooking. We recommend booking soon to secure your preferred time.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/caregiver-availability" class="button" style="color: white !important;">Book Again</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Care System. All rights reserved.</p>
          <p>Need help? Contact our support team at support@homecaresystem.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendBookingExpiredNotification = async (patientEmail, bookingDetails) => {
  const subject = 'Booking Expired - Home Care System';
  const formattedExpiry = new Date(bookingDetails.expiresAt).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fffbf0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #f57c00; }
        .content { padding: 30px 20px; }
        .expired-box { padding: 20px; border: 2px solid #f57c00; border-radius: 4px; margin: 20px 0; background: #fffbf0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .info-box { padding: 15px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; background: #fafafa; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏱ Booking Expired</h1>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.patientName},</p>
          <p>Your booking reservation has expired because payment was not completed within the time limit. The time slot has been released and is now available for others to book.</p>

          <div class="expired-box">
            <div class="detail-row">
              <strong>Booking ID:</strong>
              <span>${bookingDetails.bookingId}</span>
            </div>
            <div class="detail-row">
              <strong>Expired At:</strong>
              <span>${formattedExpiry}</span>
            </div>
            <div class="detail-row">
              <strong>Reason:</strong>
              <span>Payment not completed within 10 minutes</span>
            </div>
          </div>

          <div class="info-box">
            <strong>What happened?</strong>
            <p style="margin: 8px 0 0 0;">To ensure fair access to appointments, we hold time slots for 10 minutes. Since payment wasn't completed within this timeframe, the slot has been automatically released.</p>
          </div>

          <div class="info-box">
            <strong>Want to book again?</strong>
            <p style="margin: 8px 0 0 0;">
              The time slot may still be available! Click the button below to view available appointments and complete your booking quickly.
            </p>
          </div>

          <p><strong>Tip:</strong> Complete your payment within 10 minutes to secure your booking. Have your payment method ready before starting the booking process.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/caregiver-availability" class="button" style="color: white !important;">View Available Slots</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Care System. All rights reserved.</p>
          <p>Questions? Contact support@homecaresystem.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendRescheduleNotification = async (recipientEmail, recipientName, rescheduleBy, rescheduleByName, newDateTime) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Appointment Rescheduled - ${systemName}`;
  const isPatient = rescheduleBy === 'patient';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .reschedule-box { padding: 20px; border: 2px solid #1976d2; border-radius: 4px; margin: 20px 0; background: #f0f8ff; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .new-time { font-size: 18px; font-weight: 600; color: #1976d2; }
        .button { display: inline-block; background: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Appointment Rescheduled</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>
          <p>Your appointment has been rescheduled by ${isPatient ? 'your patient' : 'your caregiver'} (${rescheduleByName}).</p>

          <div class="reschedule-box">
            <div class="detail-row">
              <strong>New Date & Time:</strong>
              <span class="new-time">${newDateTime}</span>
            </div>
            <div class="detail-row">
              <strong>Rescheduled By:</strong>
              <span>${rescheduleByName} (${rescheduleBy})</span>
            </div>
            <div class="detail-row">
              <strong>Rescheduled At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          <p>Please update your calendar with the new appointment time. If you have any concerns about this change, please contact ${isPatient ? 'your patient' : 'your caregiver'} directly.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/${isPatient ? 'appointments' : 'schedule'}" class="button" style="color: white !important;">View ${isPatient ? 'Appointments' : 'Schedule'}</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendCancellationNotification = async (recipientEmail, recipientName, appointmentDateTime, reason) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Appointment Cancelled - ${systemName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fff5f5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #d32f2f; }
        .content { padding: 30px 20px; }
        .cancellation-box { padding: 20px; border: 2px solid #d32f2f; border-radius: 4px; margin: 20px 0; background: #fff5f5; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>
          <p>We're writing to inform you that an appointment has been cancelled by the patient.</p>

          <div class="cancellation-box">
            <div class="detail-row">
              <strong>Appointment:</strong>
              <span>${appointmentDateTime}</span>
            </div>
            <div class="detail-row">
              <strong>Cancelled At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
            ${reason ? `
            <div class="detail-row">
              <strong>Reason:</strong>
              <span>${reason}</span>
            </div>
            ` : ''}
          </div>

          <p>The time slot has been released and is now available for other bookings. No refund will be processed as per our cancellation policy.</p>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/appointments" class="button" style="color: white !important;">View Appointments</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendUserWelcomeEmail = async (userDetails) => {
  const systemName = process.env.SYSTEM || 'CareConnect';
  const subject = `Welcome to ${systemName} - Account Created`;
  const { email, firstName, lastName, password, role, assignedRegion } = userDetails;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .credentials-box { padding: 20px; border: 2px solid #1976d2; border-radius: 4px; margin: 20px 0; background: #f0f8ff; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .password { font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .button { display: inline-block; background: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to ${systemName}</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName} ${lastName},</p>
          <p>Your account has been successfully created by the system administrator. Below are your login credentials and account details:</p>

          <div class="credentials-box">
            <div class="detail-row">
              <strong>Email:</strong>
              <span>${email}</span>
            </div>
            <div class="detail-row">
              <strong>Password:</strong>
              <span class="password">${password}</span>
            </div>
            <div class="detail-row">
              <strong>Role:</strong>
              <span>${role.replace('_', ' ').toUpperCase()}</span>
            </div>
            ${assignedRegion && assignedRegion !== 'All regions' ? `
            <div class="detail-row">
              <strong>Assigned Region:</strong>
              <span>${assignedRegion}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <strong>Account Created:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div class="warning">
            <strong>🔒 Security Notice:</strong>
            <p style="margin: 8px 0 0 0;">For security reasons, please change your password immediately after your first login. Keep your credentials secure and do not share them with anyone.</p>
          </div>

          <p><strong>Getting Started:</strong></p>
          <ul>
            <li>Log in using the credentials above</li>
            <li>Change your password in your profile settings</li>
            <li>Complete your profile information</li>
            <li>Familiarize yourself with the system features</li>
          </ul>

          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/login" class="button" style="color: white !important;">Login to ${systemName}</a>
          </center>

          <p>If you have any questions or need assistance, please contact the system administrator.</p>

          <p>Welcome to the team!</p>
          <p>Best regards,<br>${systemName} Administration Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This email contains sensitive information. Please keep it secure.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendStatusAlert,
  sendPasswordChangeNotification,
  sendPasswordResetEmail,
  sendCaregiverRegistrationNotification,
  sendCaregiverApprovalNotification,
  sendPaymentConfirmation,
  sendPaymentFailureNotification,
  sendBookingExpiredNotification,
  sendRescheduleNotification,
  sendCancellationNotification,
  sendUserWelcomeEmail
};
