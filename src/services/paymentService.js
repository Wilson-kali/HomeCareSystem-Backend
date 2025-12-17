const axios = require('axios');
const crypto = require('crypto');
const { PaymentTransaction, Appointment, Caregiver, User, TimeSlot } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');
const paymentConfig = require('../config/payment');
const logger = require('../utils/logger');
const { sendPaymentConfirmation } = require('./emailService');

/**
 * Initialize Paychangu Payment
 * Creates a payment request and returns checkout URL
 */
const initiatePayment = async (appointmentId, customerDetails) => {
  try {
    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Generate unique transaction reference
    const tx_ref = `HC-${appointmentId}-${Date.now()}`;

    // Paychangu API payload - matching working test format
    const paymentData = {
      amount: appointment.totalCost,
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
        description: `Payment for Appointment #${appointmentId}`
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

    // Create payment transaction record
    const transaction = await PaymentTransaction.create({
      appointmentId,
      amount: appointment.totalCost,
      currency: paymentConfig.paychangu.currency,
      paymentMethod: 'paychangu',
      stripePaymentIntentId: tx_ref, // Reusing field for tx_ref
      status: PAYMENT_STATUS.PENDING,
      metadata: {
        checkout_url: response.data.data?.checkout_url,
        tx_ref: response.data.data?.data?.tx_ref || tx_ref,
        mode: response.data.data?.data?.mode
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

    // Update appointment payment status and auto-confirm if payment is successful
    if (newStatus === PAYMENT_STATUS.COMPLETED) {
      const appointment = await Appointment.findByPk(transaction.appointmentId, {
        include: [
          { 
            model: Caregiver,
            include: [{ model: User }]
          },
          { model: User, as: 'Patient' },
          { model: TimeSlot }
        ]
      });
      
      if (appointment) {
        // Always update payment status
        appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
        
        // Auto-confirm if caregiver allows it
        if (appointment.Caregiver?.autoConfirm) {
          appointment.status = 'confirmed';
        }
        
        await appointment.save();
        logger.info(`Appointment payment updated: ${appointment.id}, status: ${appointment.status}`);
        
        // Send payment confirmation email to patient
        try {
          if (appointment.Patient?.email) {
            await sendPaymentConfirmation(appointment.Patient.email, {
              patientName: `${appointment.Patient.firstName} ${appointment.Patient.lastName}`,
              amount: transaction.amount,
              transactionId: tx_ref,
              appointmentDate: appointment.TimeSlot?.date || appointment.scheduledDate,
              caregiverName: appointment.Caregiver?.User ? 
                `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}` : 
                'Your Caregiver'
            });
            logger.info(`Payment confirmation email sent to: ${appointment.Patient.email}`);
          }
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email:', emailError);
          // Don't throw error - payment processing should continue even if email fails
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

module.exports = {
  initiatePayment,
  verifyPayment,
  processWebhook,
  verifyWebhookSignature,
  getPaymentByTxRef,
  getAppointmentPayments
};