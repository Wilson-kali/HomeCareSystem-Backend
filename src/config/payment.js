require('dotenv').config();

module.exports = {
  paychangu: {
    publicKey: process.env.TEST_PUBLIC_KEY,
    secretKey: process.env.TEST_SECRET_KEY,
    webhookSecret: process.env.TEST_WEBHOOK_SECRET,
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
    apiUrl: 'https://api.paychangu.com',
    currency: 'MWK', // Malawi Kwacha
    environment: process.env.NODE_ENV || 'development'
  }
};
