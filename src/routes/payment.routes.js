const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  initiateAppointmentPayment,
  verifyPaymentStatus,
  handlePaymentWebhook,
  getPaymentsForAppointment,
  getPaymentHistory
} = require('../controllers/paymentController');

const router = express.Router();

// Webhook endpoint (no auth required)
router.post('/webhook', handlePaymentWebhook);

// Authenticated routes
router.use(authenticateToken);

// Initiate payment for appointment
router.post('/initiate', initiateAppointmentPayment);

// Verify payment status
router.get('/verify/:tx_ref', verifyPaymentStatus);

// Get payments for specific appointment
router.get('/appointment/:appointmentId', getPaymentsForAppointment);

// Get payment history for current user
router.get('/history', getPaymentHistory);

module.exports = router;