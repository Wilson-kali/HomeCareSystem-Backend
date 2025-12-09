const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata
    });
    return paymentIntent;
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
};

const processRefund = async (paymentIntentId, amount) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined
    });
    return refund;
  } catch (error) {
    console.error('Refund error:', error);
    throw error;
  }
};

module.exports = { createPaymentIntent, processRefund };
