const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PaymentTransaction } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');

const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata
    });
    
    return paymentIntent;
  } catch (error) {
    throw new Error(`Payment creation failed: ${error.message}`);
  }
};

const processPayment = async (appointmentId, amount, paymentMethodId) => {
  try {
    const paymentIntent = await createPaymentIntent(amount, 'usd', {
      appointmentId: appointmentId.toString()
    });

    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethodId
    });

    const transaction = await PaymentTransaction.create({
      appointmentId,
      amount,
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      status: confirmedPayment.status === 'succeeded' ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING,
      paidAt: confirmedPayment.status === 'succeeded' ? new Date() : null
    });

    return { transaction, paymentIntent: confirmedPayment };
  } catch (error) {
    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

const refundPayment = async (paymentIntentId, amount) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined
    });
    
    return refund;
  } catch (error) {
    throw new Error(`Refund failed: ${error.message}`);
  }
};

module.exports = {
  createPaymentIntent,
  processPayment,
  refundPayment
};