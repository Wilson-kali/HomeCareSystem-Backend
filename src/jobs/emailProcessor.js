const cron = require('node-cron');
const EmailScheduler = require('../services/emailScheduler');

// Process email queue every minute
const startEmailProcessor = () => {
  cron.schedule('* * * * *', async () => {
    console.log('Processing email queue...');
    await EmailScheduler.processEmailQueue();
  });
  
  console.log('Email processor started - running every minute');
};

module.exports = { startEmailProcessor };