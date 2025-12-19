const axios = require('axios');
const crypto = require('crypto');
const { PaymentTransaction, Appointment, Caregiver, User, TimeSlot } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');
const paymentConfig = require('../config/payment');
const logger = require('../utils/logger');
const { sendPaymentConfirmation } = require('./emailService');

/**
 * Initialize Paychangu Payment for Booking
 * Creates a payment request without existing appointment
 */
const initiateBookingPayment = async (bookingData, customerDetails) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, patientId, caregiverId } = bookingData;
    
    // Get specialty to calculate fees
    const { Specialty } = require('../models');
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) {
      throw new Error('Specialty not found');
    }

    const bookingFee = specialty.bookingFee || 0;
    const sessionFee = specialty.sessionFee || 0;

    // Generate unique transaction reference
    const tx_ref = `HC-BOOKING-${timeSlotId}-${Date.now()}`;

    // Use booking fee for initial payment
    const paymentAmount = bookingFee;
    
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
        description: `Booking Fee for Appointment #${appointmentId}`
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

    // Create payment transaction record with booking data
    const transaction = await PaymentTransaction.create({
      appointmentId: null, // Will be set after appointment creation
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      paymentMethod: 'paychangu',
      stripePaymentIntentId: tx_ref, // Reusing field for tx_ref
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
        }
      }
    });

    logger.info(`Payment initiated: ${tx_ref}`, { appointmentId, amount: appointment.totalCost });

    return {
      transaction,
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
 * Validate and update payment status
 */
const processWebhook = async (webhookData, signature) => {
  try {
    // Verify webhook signature
    const isValid = verifyWebhookSignature(webhookData, signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const { tx_ref, status, amount } = webhookData;

    // Find transaction by tx_ref
    const transaction = await PaymentTransaction.findOne({
      where: { stripePaymentIntentId: tx_ref }
    });

    if (!transaction) {
      logger.warn(`Transaction not found for tx_ref: ${tx_ref}`);
      return null;
    }

    // Update transaction status
    let newStatus = PAYMENT_STATUS.PENDING;
    if (status === 'successful' || status === 'success') {
      newStatus = PAYMENT_STATUS.COMPLETED;
      transaction.paidAt = new Date();
    } else if (status === 'failed') {
      newStatus = PAYMENT_STATUS.FAILED;
    }

    transaction.status = newStatus;
    await transaction.save();

    // Create appointment and update payment status when payment is successful
    if (newStatus === PAYMENT_STATUS.COMPLETED) {
      let appointment;
      
      // If appointment doesn't exist yet, create it from booking data
      if (!transaction.appointmentId && transaction.metadata?.bookingData) {
        const bookingData = transaction.metadata.bookingData;
        const { TimeSlot, Patient } = require('../models');
        
        // Get time slot details
        const timeSlot = await TimeSlot.findByPk(bookingData.timeSlotId);
        if (!timeSlot) {
          throw new Error('Time slot not found');
        }
        
        // Create appointment with booking fee already paid
        const { APPOINTMENT_STATUS } = require('../utils/constants');
        appointment = await Appointment.create({
          patientId: bookingData.patientId,
          caregiverId: bookingData.caregiverId,
          specialtyId: bookingData.specialtyId,
          scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
          duration: timeSlot.duration,
          sessionType: bookingData.sessionType,
          notes: bookingData.notes,
          bookingFee: bookingData.bookingFee,
          sessionFee: bookingData.sessionFee,
          totalCost: parseFloat(bookingData.bookingFee) + parseFloat(bookingData.sessionFee),
          timeSlotId: bookingData.timeSlotId,
          status: APPOINTMENT_STATUS.SESSION_WAITING,
          bookingFeeStatus: PAYMENT_STATUS.COMPLETED,
          sessionFeeStatus: PAYMENT_STATUS.PENDING,
          paymentStatus: PAYMENT_STATUS.PARTIAL,
          bookedAt: new Date()
        });
        
        // Update transaction with appointment ID
        transaction.appointmentId = appointment.id;
        await transaction.save();
        
        // Mark time slot as booked
        await timeSlot.update({
          status: 'booked',
          isBooked: true,
          appointmentId: appointment.id,
          lockedUntil: null
        });
        
        logger.info(`Appointment created from payment: ${appointment.id}`);
      } else {
        // Existing appointment - update payment status based on payment type
        const { APPOINTMENT_STATUS } = require('../utils/constants');
        appointment = await Appointment.findByPk(transaction.appointmentId);
        if (appointment) {
          // Determine payment type based on appointment status and existing payments
          let paymentType = transaction.paymentType || transaction.metadata?.paymentType;
          
          // If no explicit payment type and appointment exists with booking fee already paid, this is session fee
          if (!paymentType && appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED) {
            paymentType = 'session_fee';
          } else if (!paymentType) {
            paymentType = 'booking_fee';
          }
          
          if (paymentType === 'session_fee') {
            // Determine overall payment status based on booking fee status
            let overallPaymentStatus = 'completed';
            let appointmentStatus = 'session_attended';
            
            if (appointment.bookingFeeStatus !== PAYMENT_STATUS.COMPLETED) {
              overallPaymentStatus = 'partial';
              appointmentStatus = 'session_waiting';
            }
            
            logger.info(`Updating session fee for appointment ${appointment.id}:`, {
              sessionFeeStatus: 'completed',
              bookingFeeStatus: appointment.bookingFeeStatus,
              paymentStatus: overallPaymentStatus,
              status: appointmentStatus
            });
            
            // Force update session fee fields using raw SQL with exact column names
            const { QueryTypes } = require('sequelize');
            const sequelize = require('../config/database');
            const currentTime = new Date();
            
            logger.info(`SQL Update values:`, {
              overallPaymentStatus,
              appointmentStatus,
              appointmentId: appointment.id
            });
            
            await sequelize.query(
              `UPDATE Appointments SET 
               session_fee_status = 'completed', 
               session_paid_at = ?, 
               paymentStatus = ?, 
               status = ?
               WHERE id = ?`,
              {
                replacements: [currentTime, overallPaymentStatus, appointmentStatus, appointment.id],
                type: QueryTypes.UPDATE
              }
            );
            
            logger.info(`Session fee payment completed for appointment ${appointment.id}`);
          } else {
            // Default to booking fee
            let overallPaymentStatus = PAYMENT_STATUS.PARTIAL;
            if (appointment.sessionFeeStatus === PAYMENT_STATUS.COMPLETED) {
              overallPaymentStatus = PAYMENT_STATUS.COMPLETED;
            }
            
            logger.info(`Updating booking fee for appointment ${appointment.id}:`, {
              bookingFeeStatus: 'completed',
              sessionFeeStatus: appointment.sessionFeeStatus,
              paymentStatus: overallPaymentStatus,
              status: APPOINTMENT_STATUS.SESSION_WAITING
            });
            
            // Force update booking fee fields using exact database field names
            await Appointment.update({
              booking_fee_status: PAYMENT_STATUS.COMPLETED,
              paymentStatus: overallPaymentStatus,
              status: APPOINTMENT_STATUS.SESSION_WAITING,
              bookedAt: new Date()
            }, {
              where: { id: appointment.id }
            });
            
            logger.info(`Booking fee payment completed for appointment ${appointment.id}`);
          }
        }
      }
      
      if (appointment) {
        // Load full appointment data for email
        const { Patient } = require('../models');
        const fullAppointment = await Appointment.findByPk(appointment.id, {
          include: [
            { 
              model: Caregiver,
              include: [{ model: User }]
            },
            { 
              model: Patient,
              include: [{ model: User }]
            },
            { model: TimeSlot }
          ]
        });
        
        // Status is already set to session_waiting, no need to auto-confirm
        
        logger.info(`Booking fee payment completed: ${appointment.id}, status: ${fullAppointment.status}`);
        
        // Send payment confirmation email to patient
        try {
          if (fullAppointment.Patient?.User?.email) {
            await sendPaymentConfirmation(fullAppointment.Patient.User.email, {
              patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
              amount: transaction.amount,
              transactionId: tx_ref,
              appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
              caregiverName: fullAppointment.Caregiver?.User ? 
                `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}` : 
                'Your Caregiver'
            });
            logger.info(`Booking fee confirmation email sent to: ${fullAppointment.Patient.User.email}`);
          }
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email:', emailError);
        }
      }
    }

    logger.info(`Payment webhook processed: ${tx_ref}`, { status: newStatus });

    return transaction;
  } catch (error) {
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

/**
 * Initialize Paychangu Payment (Legacy - for existing appointments)
 * Creates a payment request and returns checkout URL
 */
const initiatePayment = async (appointmentId, customerDetails, paymentType = 'booking_fee', customAmount = null) => {
  try {
    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Generate unique transaction reference
    const tx_ref = `HC-${appointmentId}-${Date.now()}`;

    // Determine payment amount based on payment type
    let paymentAmount;
    if (paymentType === 'session_fee') {
      paymentAmount = customAmount || appointment.sessionFee;
    } else {
      paymentAmount = customAmount || appointment.bookingFee || appointment.totalCost;
    }
    
    // Paychangu API payload
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
        description: `Booking Fee for Appointment #${appointmentId}`
      }
    };

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

    // Create payment transaction record
    const transaction = await PaymentTransaction.create({
      appointmentId,
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      paymentMethod: 'paychangu',
      stripePaymentIntentId: tx_ref,
      status: PAYMENT_STATUS.PENDING,
      paymentType: paymentType,
      metadata: {
        checkout_url: response.data.data?.checkout_url,
        tx_ref: response.data.data?.data?.tx_ref || tx_ref,
        mode: response.data.data?.data?.mode,
        paymentType: 'booking_fee'
      }
    });

    return {
      transaction,
      checkoutUrl: response.data.data.checkout_url,
      tx_ref: response.data.data.data.tx_ref,
      status: response.data.status
    };
  } catch (error) {
    logger.error('Payment initiation failed:', error);
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(`Payment creation failed: ${errorMessage}`);
  }
};

module.exports = {
  initiatePayment,
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  verifyWebhookSignature,
  getPaymentByTxRef,
  getAppointmentPayments
};