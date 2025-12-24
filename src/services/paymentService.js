const axios = require('axios');
const crypto = require('crypto');
const { PaymentTransaction, PendingPaymentTransaction, Appointment, Caregiver, User, TimeSlot, PendingBooking, sequelize } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');
const paymentConfig = require('../config/payment');
const logger = require('../utils/logger');
const { sendPaymentConfirmation, sendPaymentFailureNotification } = require('./emailService');
const bookingService = require('./bookingService');

/**
 * Initialize Paychangu Payment for Booking
 * Creates a payment request without existing appointment
 */
const initiateBookingPayment = async (bookingData, customerDetails, pendingBookingId) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, patientId, caregiverId } = bookingData;
    
    // Get specialty to calculate fees
    const { Specialty } = require('../models');
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) {
      throw new Error('Specialty not found');
    }

    const bookingFee = parseFloat(specialty.bookingFee || 0);
    const sessionFee = parseFloat(specialty.sessionFee || 0);

    // Calculate convenience fee
    const convenienceFeePercentage = paymentConfig.paychangu.convenienceFeePercentage;
    const bookingConvenienceFee = Math.round((bookingFee * convenienceFeePercentage) / 100);
    const totalBookingAmount = parseFloat((bookingFee + bookingConvenienceFee).toFixed(2));

    // Generate unique transaction reference
    const tx_ref = `HC-BOOKING-${timeSlotId}-${Date.now()}`;

    // Use total booking fee for initial payment (including convenience fee)
    const paymentAmount = totalBookingAmount;
    const paymentType = 'booking_fee';

    // Paychangu API payload - matching working test format
    const paymentData = {
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      email: customerDetails.email,
      first_name: customerDetails.firstName,
      last_name: customerDetails.lastName,
      phone_number: customerDetails.phone,
      callback_url: `${paymentConfig.paychangu.webhookBaseUrl}/api/payments/webhook`,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing?status=success`,
      tx_ref: tx_ref,
      customization: {
        title: 'Home Care System',
        description: `Booking Fee for Appointment with ${specialty.name}`
      }
    };

    // Log payment data for debugging
    console.log('💳 Initiating Paychangu payment:', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      email: paymentData.email,
      tx_ref: paymentData.tx_ref
    });

    // Call Paychangu API
    const response = await axios.post(
      `${paymentConfig.paychangu.apiUrl}/payment`,
      paymentData,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
        }
      }
    );

    // Create pending payment transaction record
    const pendingTransaction = await PendingPaymentTransaction.create({
      pendingBookingId: pendingBookingId,
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      paymentMethod: 'paychangu',
      paymentType: paymentType,
      tx_ref: tx_ref,
      status: PAYMENT_STATUS.PENDING,
      metadata: {
        checkout_url: response.data.data?.checkout_url,
        tx_ref: response.data.data?.data?.tx_ref || tx_ref,
        mode: response.data.data?.data?.mode,
        paymentType: paymentType,
        bookingData: {
          timeSlotId,
          specialtyId,
          sessionType,
          notes,
          patientId,
          caregiverId,
          bookingFee,
          sessionFee
        },
        feeBreakdown: {
          baseFee: bookingFee,
          convenienceFee: bookingConvenienceFee,
          convenienceFeePercentage: convenienceFeePercentage,
          totalAmount: totalBookingAmount
        }
      }
    });

    logger.info(`Booking payment initiated: ${tx_ref}`, {
      timeSlotId,
      specialtyId,
      amount: paymentAmount,
      bookingFee,
      sessionFee
    });

    return {
      transaction: pendingTransaction,
      checkoutUrl: response.data.data.checkout_url,
      tx_ref: response.data.data.data.tx_ref,
      status: response.data.status
    };
  } catch (error) {
    console.error('❌ Paychangu API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    
    logger.error('Payment initiation failed:', error);
    
    // Return more specific error message
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(`Payment creation failed: ${errorMessage}`);
  }
};

/**
 * Verify Paychangu Payment
 * Check payment status using transaction reference
 */
const verifyPayment = async (tx_ref) => {
  try {
    const response = await axios.get(
      `${paymentConfig.paychangu.apiUrl}/verify-payment/${tx_ref}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Payment verification failed:', error);
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

/**
 * Process Webhook from Paychangu
 * Validate and update payment status with pending booking integration
 */
const processWebhook = async (webhookData, signature) => {
  const t = await sequelize.transaction();

  try {
    // Verify webhook signature
    const isValid = verifyWebhookSignature(webhookData, signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const { tx_ref, status, amount } = webhookData;

    // Find pending payment transaction by tx_ref
    const pendingTransaction = await PendingPaymentTransaction.findOne({
      where: { tx_ref: tx_ref },
      transaction: t
    });

    if (!pendingTransaction) {
      logger.warn(`Pending transaction not found for tx_ref: ${tx_ref}`);
      await t.rollback();
      return null;
    }

    // Check if already processed (idempotency)
    if (pendingTransaction.status === PAYMENT_STATUS.COMPLETED) {
      logger.info(`Payment ${tx_ref} already processed, skipping`);
      await t.commit();
      return pendingTransaction;
    }

    // Update pending transaction status
    let newStatus = PAYMENT_STATUS.PENDING;
    if (status === 'successful' || status === 'success') {
      newStatus = PAYMENT_STATUS.COMPLETED;
      pendingTransaction.paidAt = new Date();
    } else if (status === 'failed') {
      newStatus = PAYMENT_STATUS.FAILED;
    }

    pendingTransaction.status = newStatus;
    await pendingTransaction.save({ transaction: t });

    // Handle successful payment
    if (newStatus === PAYMENT_STATUS.COMPLETED) {
      let appointment;

      // Find pending booking by tx_ref
      const pendingBooking = await PendingBooking.findOne({
        where: { tx_ref: tx_ref },
        transaction: t
      });

      if (pendingBooking) {
        // Convert pending booking to appointment
        const { appointment: newAppointment } = await bookingService.convertPendingBookingToAppointment(
          pendingBooking.id,
          tx_ref,
          t
        );

        appointment = newAppointment;

        // Extract fee breakdown from metadata
        const feeBreakdown = pendingTransaction.metadata?.feeBreakdown || {};

        // Transfer pending payment to actual PaymentTransaction table
        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: feeBreakdown.baseFee || null,
          taxRate: feeBreakdown.taxRate || null,
          taxAmount: feeBreakdown.taxAmount || null,
          convenienceFeeRate: feeBreakdown.convenienceFeeRate || feeBreakdown.convenienceFeePercentage || null,
          convenienceFeeAmount: feeBreakdown.convenienceFeeAmount || feeBreakdown.convenienceFee || null,
          platformCommissionRate: feeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: feeBreakdown.platformCommissionAmount || null,
          caregiverEarnings: feeBreakdown.caregiverEarnings || null,
          currency: pendingTransaction.currency,
          paymentMethod: pendingTransaction.paymentMethod,
          paymentType: pendingTransaction.paymentType,
          stripePaymentIntentId: pendingTransaction.tx_ref,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: pendingTransaction.metadata
        }, { transaction: t });

        // Mark pending transaction as converted
        await pendingTransaction.update({
          convertedToPaymentId: actualTransaction.id
        }, { transaction: t });

        logger.info(`Pending payment ${pendingTransaction.id} converted to payment ${actualTransaction.id}`);
      } else if (pendingTransaction.appointmentId) {
        // Handle session fee payment for existing appointment
        logger.info(`Processing session fee payment for appointment ${pendingTransaction.appointmentId}`);

        appointment = await Appointment.findByPk(pendingTransaction.appointmentId, { transaction: t });

        if (!appointment) {
          throw new Error(`Appointment ${pendingTransaction.appointmentId} not found for session fee payment`);
        }

        // Calculate overall payment status
        const overallPaymentStatus = appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED ? 'completed' : 'partial';

        // Update appointment session fee status and mark as attended
        const { QueryTypes } = require('sequelize');
        const currentTime = new Date();

        await sequelize.query(
          `UPDATE appointments SET
           session_fee_status = 'completed',
           session_paid_at = ?,
           paymentStatus = ?,
           status = 'session_attended'
           WHERE id = ?`,
          {
            replacements: [currentTime, overallPaymentStatus, appointment.id],
            type: QueryTypes.UPDATE,
            transaction: t
          }
        );

        // Extract fee breakdown from metadata
        const sessionFeeBreakdown = pendingTransaction.metadata?.feeBreakdown || {};

        // Create actual PaymentTransaction record
        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: sessionFeeBreakdown.baseFee || null,
          taxRate: sessionFeeBreakdown.taxRate || null,
          taxAmount: sessionFeeBreakdown.taxAmount || null,
          convenienceFeeRate: sessionFeeBreakdown.convenienceFeeRate || sessionFeeBreakdown.convenienceFeePercentage || null,
          convenienceFeeAmount: sessionFeeBreakdown.convenienceFeeAmount || sessionFeeBreakdown.convenienceFee || null,
          platformCommissionRate: sessionFeeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: sessionFeeBreakdown.platformCommissionAmount || null,
          caregiverEarnings: sessionFeeBreakdown.caregiverEarnings || null,
          currency: pendingTransaction.currency,
          paymentMethod: pendingTransaction.paymentMethod,
          paymentType: 'session_fee',
          stripePaymentIntentId: pendingTransaction.tx_ref,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: pendingTransaction.metadata
        }, { transaction: t });

        // Mark pending transaction as converted
        await pendingTransaction.update({
          convertedToPaymentId: actualTransaction.id
        }, { transaction: t });

        logger.info(`Session fee payment ${actualTransaction.id} completed for appointment ${appointment.id}`);
      } else {
        // Invalid pending transaction state
        throw new Error(`Invalid pending transaction: missing both pendingBookingId and appointmentId for tx_ref ${tx_ref}`);
      }

      // Commit transaction before sending emails
      await t.commit();

      // Send confirmation email (outside transaction)
      if (appointment) {
        try {
          const { Patient } = require('../models');
          const fullAppointment = await Appointment.findByPk(appointment.id, {
            include: [
              { model: Caregiver, include: [{ model: User }] },
              { model: Patient, include: [{ model: User }] },
              { model: TimeSlot }
            ]
          });

          if (fullAppointment?.Patient?.User?.email) {
            await sendPaymentConfirmation(fullAppointment.Patient.User.email, {
              patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
              amount: pendingTransaction.amount,
              transactionId: tx_ref,
              appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
              caregiverName: fullAppointment.Caregiver?.User ?
                `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}` :
                'Your Caregiver'
            });
            logger.info(`Payment confirmation email sent to: ${fullAppointment.Patient.User.email}`);
          }
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email:', emailError);
        }
      }

      return pendingTransaction;
    }

    // Handle failed payment
    if (newStatus === PAYMENT_STATUS.FAILED) {
      // Find pending booking associated with this transaction
      const pendingBooking = await PendingBooking.findOne({
        where: {
          tx_ref: tx_ref
        },
        transaction: t
      });

      if (pendingBooking && pendingBooking.status !== 'expired' && pendingBooking.status !== 'payment_failed') {
        // Release pending booking and slot
        await bookingService.releasePendingBooking(pendingBooking.id, 'payment_failed', t);
        logger.info(`Released pending booking ${pendingBooking.id} due to payment failure`);
      }

      await t.commit();

      // Send failure notification email (outside transaction)
      if (pendingBooking) {
        try {
          const { Patient } = require('../models');
          const bookingWithPatient = await PendingBooking.findByPk(pendingBooking.id, {
            include: [{ model: Patient, include: [{ model: User }] }]
          });

          if (bookingWithPatient?.Patient?.User?.email) {
            await sendPaymentFailureNotification(bookingWithPatient.Patient.User.email, {
              patientName: `${bookingWithPatient.Patient.User.firstName} ${bookingWithPatient.Patient.User.lastName}`,
              tx_ref: tx_ref,
              amount: pendingTransaction.amount,
              bookingId: pendingBooking.id
            });

            // Mark notification as sent
            await bookingWithPatient.update({ notificationSent: true });

            logger.info(`Payment failure notification sent to: ${bookingWithPatient.Patient.User.email}`);
          }
        } catch (emailError) {
          logger.error('Failed to send payment failure notification:', emailError);
        }
      }

      return pendingTransaction;
    }

    // For pending status, just commit
    await t.commit();
    logger.info(`Payment webhook processed: ${tx_ref}`, { status: newStatus });

    return pendingTransaction;
  } catch (error) {
    await t.rollback();
    logger.error('Webhook processing failed:', error);
    throw error;
  }
};

/**
 * Verify Webhook Signature
 * Ensures webhook is from Paychangu
 */
const verifyWebhookSignature = (data, signature) => {
  const webhookSecret = paymentConfig.paychangu.webhookSecret;
  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(data))
    .digest('hex');

  return hash === signature;
};

/**
 * Get Payment by Transaction Reference
 */
const getPaymentByTxRef = async (tx_ref) => {
  try {
    const transaction = await PaymentTransaction.findOne({
      where: { stripePaymentIntentId: tx_ref },
      include: [{ model: Appointment }]
    });

    return transaction;
  } catch (error) {
    logger.error('Get payment failed:', error);
    throw new Error(`Failed to retrieve payment: ${error.message}`);
  }
};

/**
 * Get All Payments for an Appointment
 */
const getAppointmentPayments = async (appointmentId) => {
  try {
    const transactions = await PaymentTransaction.findAll({
      where: { appointmentId },
      order: [['createdAt', 'DESC']]
    });

    return transactions;
  } catch (error) {
    logger.error('Get appointment payments failed:', error);
    throw new Error(`Failed to retrieve payments: ${error.message}`);
  }
};


module.exports = {
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  verifyWebhookSignature,
  getPaymentByTxRef,
  getAppointmentPayments
};