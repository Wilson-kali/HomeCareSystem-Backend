const {
  initiatePayment,
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  getPaymentByTxRef,
  getAppointmentPayments
} = require('../services/paymentService');
const bookingService = require('../services/bookingService');
const { User, Patient, TimeSlot, Location } = require('../models');

/**
 * Initiate Booking Payment with Race Condition Prevention
 * Uses pending bookings and database transactions for atomic slot locking
 * POST /api/payments/initiate-booking
 */
const initiateBookingPaymentEndpoint = async (req, res, next) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, phoneNumber, locationId } = req.body;

    // Validate required fields
    if (!timeSlotId || !specialtyId) {
      return res.status(400).json({
        error: 'Missing required fields: timeSlotId and specialtyId are required'
      });
    }

    // Get patient details
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [{ model: User }]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Get time slot to retrieve caregiver ID
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    // Prepare booking data
    const bookingData = {
      timeSlotId,
      specialtyId,
      sessionType: sessionType || 'in_person',
      notes: notes || null,
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      locationId: locationId || null
    };

    // Step 1: Atomically lock slot and create pending booking with transaction
    const { pendingBooking, lockedUntil } = await bookingService.lockSlotWithPendingBooking(bookingData);

    console.log('✅ Pending booking created:', {
      id: pendingBooking.id,
      timeSlotId: pendingBooking.timeSlotId,
      expiresAt: lockedUntil
    });

    // Step 2: Prepare customer details for payment
    const customerDetails = {
      email: patient.User.email,
      firstName: patient.User.firstName,
      lastName: patient.User.lastName,
      phone: phoneNumber || patient.User.phone || '+265 998 95 15 10'
    };

    // Step 3: Initiate payment with Paychangu
    const paymentResult = await initiateBookingPayment(bookingData, customerDetails, pendingBooking.id);

    console.log('💳 Payment initiated:', {
      tx_ref: paymentResult.tx_ref,
      checkoutUrl: paymentResult.checkoutUrl
    });

    // Step 4: Update pending booking with payment reference and link to pending transaction
    await pendingBooking.update({
      tx_ref: paymentResult.tx_ref,
      status: 'payment_initiated'
    });

    // Update pending payment transaction with booking ID
    await paymentResult.transaction.update({
      pendingBookingId: pendingBooking.id
    });

    console.log('🔗 Pending booking linked to payment:', {
      pendingBookingId: pendingBooking.id,
      tx_ref: paymentResult.tx_ref
    });

    // Return response with checkout URL
    res.status(201).json({
      message: 'Booking payment initiated successfully',
      checkoutUrl: paymentResult.checkoutUrl,
      tx_ref: paymentResult.tx_ref,
      pendingBookingId: pendingBooking.id,
      expiresAt: lockedUntil,
      expiresInMinutes: 10,
      transaction: paymentResult.transaction,
      bookingFee: pendingBooking.bookingFee,
      sessionFee: pendingBooking.sessionFee,
      totalAmount: pendingBooking.totalAmount
    });
  } catch (error) {
    console.error('❌ Booking payment initiation failed:', error);

    // Provide user-friendly error messages
    if (error.message.includes('not available')) {
      return res.status(409).json({
        error: 'This time slot is no longer available. Please select a different time slot.',
        code: 'SLOT_UNAVAILABLE'
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next(error);
  }
};

/**
 * Initiate Payment for Appointment (Legacy)
 * POST /api/payments/initiate
 */
const initiateAppointmentPayment = async (req, res, next) => {
  try {
    const { appointmentId, phoneNumber, paymentType, amount } = req.body;

    // Get patient details for payment
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [{ model: User }]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const customerDetails = {
      email: patient.User.email,
      firstName: patient.User.firstName,
      lastName: patient.User.lastName,
      phone: phoneNumber || patient.User.phone || '+265 998 95 15 10'
    };

    const paymentResult = await initiatePayment(appointmentId, customerDetails, paymentType, amount);

    res.status(201).json({
      message: 'Payment initiated successfully',
      checkoutUrl: paymentResult.checkoutUrl,
      tx_ref: paymentResult.tx_ref,
      transaction: paymentResult.transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Payment Status
 * GET /api/payments/verify/:tx_ref
 */
const verifyPaymentStatus = async (req, res, next) => {
  try {
    const { tx_ref } = req.params;

    const paymentStatus = await verifyPayment(tx_ref);
    const transaction = await getPaymentByTxRef(tx_ref);

    res.json({
      payment: paymentStatus,
      transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Paychangu Webhook
 * POST /api/payments/webhook
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    console.log('🔔 Webhook received:', {
      headers: req.headers,
      body: req.body,
      method: req.method,
      url: req.url
    });

    const webhookData = req.body;
    const signature = req.headers['x-paychangu-signature'] || req.headers['x-webhook-signature'] || req.headers['signature'];

    console.log('📋 Webhook details:', {
      hasSignature: !!signature,
      signature: signature,
      dataKeys: Object.keys(webhookData || {})
    });

    if (!signature) {
      console.log('❌ Missing webhook signature');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    const transaction = await processWebhook(webhookData, signature);

    if (!transaction) {
      console.log('❌ Transaction not found');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('✅ Webhook processed successfully');
    res.json({
      message: 'Webhook processed successfully',
      status: transaction.status
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Get Appointment Payments
 * GET /api/payments/appointment/:appointmentId
 */
const getPaymentsForAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const payments = await getAppointmentPayments(appointmentId);

    res.json({
      payments,
      total: payments.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User's Payment History
 * GET /api/payments/history
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const { PaymentTransaction, Appointment } = require('../models');

    const payments = await PaymentTransaction.findAll({
      include: [{
        model: Appointment,
        where: { patientId: patient.id }
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      payments,
      total: payments.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateAppointmentPayment,
  initiateBookingPaymentEndpoint,
  verifyPaymentStatus,
  handlePaymentWebhook,
  getPaymentsForAppointment,
  getPaymentHistory
};
