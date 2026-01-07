const { EmailQueue } = require('../models');
const emailService = require('./emailService');

class EmailScheduler {
  static async queueEmail(to, template, data, scheduledAt = new Date()) {
    try {
      const emailJob = await EmailQueue.create({
        to,
        subject: this.getSubjectForTemplate(template),
        template,
        data,
        scheduledAt
      });
      
      console.log(`Email queued: ${template} to ${to}`);
      return emailJob;
    } catch (error) {
      console.error('Failed to queue email:', error);
      throw error;
    }
  }

  static getSubjectForTemplate(template) {
    const subjects = {
      'user_welcome': 'Welcome to CareConnect - Account Created',
      'caregiver_approval': 'Account Approved - CareConnect',
      'caregiver_registration': 'Registration Received - CareConnect',
      'password_reset': 'Password Reset Request - CareConnect',
      'password_change': 'Password Changed - CareConnect',
      'appointment_confirmation': 'Appointment Confirmation - Home Care System',
      'payment_confirmation': 'Payment Confirmation - Home Care System',
      'payment_failure': 'Payment Failed - Home Care System',
      'booking_expired': 'Booking Expired - Home Care System',
      'status_alert': 'Patient Status Alert',
      'reschedule_notification': 'Appointment Rescheduled - CareConnect',
      'cancellation_notification': 'Appointment Cancelled - CareConnect',
      'data_protection_notification': 'Data Protection Policy Acknowledgment - CareConnect'
    };
    return subjects[template] || 'Notification from CareConnect';
  }

  static async processEmailQueue() {
    try {
      const pendingEmails = await EmailQueue.findAll({
        where: {
          status: 'pending',
          scheduledAt: {
            [require('sequelize').Op.lte]: new Date()
          },
          attempts: {
            [require('sequelize').Op.lt]: 3
          }
        },
        limit: 10,
        order: [['scheduledAt', 'ASC']]
      });

      for (const emailJob of pendingEmails) {
        await this.processEmailJob(emailJob);
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    }
  }

  static async processEmailJob(emailJob) {
    try {
      await emailJob.update({ attempts: emailJob.attempts + 1 });

      let emailSent = false;
      
      switch (emailJob.template) {
        case 'user_welcome':
          await emailService.sendUserWelcomeEmail(emailJob.data);
          emailSent = true;
          break;
        case 'caregiver_approval':
          await emailService.sendCaregiverApprovalNotification(emailJob.data.email, emailJob.data.firstName);
          emailSent = true;
          break;
        case 'caregiver_registration':
          await emailService.sendCaregiverRegistrationNotification(emailJob.data.email, emailJob.data.firstName);
          emailSent = true;
          break;
        case 'password_reset':
          await emailService.sendPasswordResetEmail(emailJob.data.email, emailJob.data.firstName, emailJob.data.resetUrl);
          emailSent = true;
          break;
        case 'password_change':
          await emailService.sendPasswordChangeNotification(emailJob.data.email, emailJob.data.firstName);
          emailSent = true;
          break;
        case 'appointment_confirmation':
          await emailService.sendAppointmentConfirmation(emailJob.data.patientEmail, emailJob.data.appointmentDetails);
          emailSent = true;
          break;
        case 'payment_confirmation':
          await emailService.sendPaymentConfirmation(emailJob.data.patientEmail, emailJob.data.paymentDetails);
          emailSent = true;
          break;
        case 'payment_failure':
          await emailService.sendPaymentFailureNotification(emailJob.data.patientEmail, emailJob.data.paymentDetails);
          emailSent = true;
          break;
        case 'booking_expired':
          await emailService.sendBookingExpiredNotification(emailJob.data.patientEmail, emailJob.data.bookingDetails);
          emailSent = true;
          break;
        case 'status_alert':
          await emailService.sendStatusAlert(emailJob.data.recipientEmail, emailJob.data.alertDetails);
          emailSent = true;
          break;
        case 'reschedule_notification':
          await emailService.sendRescheduleNotification(emailJob.data.recipientEmail, emailJob.data.recipientName, emailJob.data.rescheduleBy, emailJob.data.rescheduleByName, emailJob.data.newDateTime);
          emailSent = true;
          break;
        case 'cancellation_notification':
          await emailService.sendCancellationNotification(emailJob.data.recipientEmail, emailJob.data.recipientName, emailJob.data.appointmentDateTime, emailJob.data.reason);
          emailSent = true;
          break;
        case 'data_protection_notification':
          await emailService.sendDataProtectionNotification(emailJob.data);
          emailSent = true;
          break;
        default:
          throw new Error(`Unknown email template: ${emailJob.template}`);
      }

      if (emailSent) {
        await emailJob.update({
          status: 'sent',
          sentAt: new Date(),
          error: null
        });
        console.log(`Email sent successfully: ${emailJob.template} to ${emailJob.to}`);
      }
    } catch (error) {
      console.error(`Failed to send email ${emailJob.id}:`, error);
      
      const status = emailJob.attempts >= 3 ? 'failed' : 'pending';
      await emailJob.update({
        status,
        error: error.message
      });
    }
  }
}

module.exports = EmailScheduler;