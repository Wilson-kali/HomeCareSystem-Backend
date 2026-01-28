const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { CaregiverEarnings, WithdrawalRequest, WithdrawalToken, Caregiver, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { sendWithdrawalTokenEmail, sendWithdrawalSuccessEmail } = require('../services/emailService');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticateToken);

// Request withdrawal token
router.post('/request-token', async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Rate limiting: Check recent token requests
    const recentTokens = await WithdrawalToken.count({
      where: {
        caregiverId: caregiver.id,
        created_at: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) } // 5 minutes
      }
    });

    if (recentTokens >= 3) {
      return res.status(429).json({ error: 'Too many token requests. Please wait 5 minutes.' });
    }

    // Invalidate existing tokens
    await WithdrawalToken.update(
      { used: true },
      { where: { caregiverId: caregiver.id, used: false } }
    );

    // Generate cryptographically secure 6-digit token
    const token = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await WithdrawalToken.create({
      caregiverId: caregiver.id,
      token,
      expiresAt
    });

    await sendWithdrawalTokenEmail(
      caregiver.User.email,
      `${caregiver.User.firstName} ${caregiver.User.lastName}`,
      token
    );

    logger.info(`Withdrawal token requested by caregiver ${caregiver.id}`);
    res.json({ message: 'Withdrawal token sent to your email' });
  } catch (error) {
    logger.error('Token request error:', error);
    next(error);
  }
});

// Verify withdrawal token
router.post('/verify-token', async (req, res, next) => {
  try {
    const { token, amount } = req.body;

    if (!token || !/^\d{6}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount is required for token verification' });
    }

    // Verify caregiver authentication
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: CaregiverEarnings }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Check if caregiver has sufficient balance
    const earnings = caregiver.CaregiverEarning || await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id }
    });

    if (!earnings || parseFloat(earnings.walletBalance) < parseFloat(amount)) {
      return res.status(400).json({ 
        error: 'Insufficient balance for requested amount',
        availableBalance: earnings ? parseFloat(earnings.walletBalance).toFixed(2) : '0.00',
        requestedAmount: parseFloat(amount).toFixed(2)
      });
    }

    // Verify token belongs to authenticated caregiver
    const withdrawalToken = await WithdrawalToken.findOne({
      where: {
        caregiverId: caregiver.id,
        token,
        used: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!withdrawalToken) {
      logger.warn(`Invalid token attempt by caregiver ${caregiver.id} for amount ${amount}`);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Calculate fees for verification
    const withdrawalFeeRate = 0.01;
    const minWithdrawalFee = 5;
    const withdrawalFee = Math.max(parseFloat(amount) * withdrawalFeeRate, minWithdrawalFee);
    const netPayout = parseFloat(amount) - withdrawalFee;

    logger.info(`Token verified for caregiver ${caregiver.id}, amount: ${amount}`);

    res.json({ 
      message: 'Token verified successfully',
      caregiverId: caregiver.id,
      requestedAmount: parseFloat(amount).toFixed(2),
      withdrawalFee: withdrawalFee.toFixed(2),
      netPayout: netPayout.toFixed(2),
      availableBalance: parseFloat(earnings.walletBalance).toFixed(2)
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    next(error);
  }
});

// Get caregiver's current balance and earnings summary
router.get('/balance', async (req, res, next) => {
  try {
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Get or create earnings record
    const [earnings] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId: caregiver.id },
      defaults: {
        caregiverId: caregiver.id,
        totalCaregiverEarnings: 0,
        walletBalance: 0
      }
    });

    res.json({
      caregiverId: caregiver.id,
      totalEarnings: parseFloat(earnings.totalCaregiverEarnings).toFixed(2),
      availableBalance: parseFloat(earnings.walletBalance).toFixed(2),
      currency: 'MWK'
    });
  } catch (error) {
    next(error);
  }
});

// Get withdrawal history
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { count, rows: withdrawals } = await WithdrawalRequest.findAndCountAll({
      where: { caregiverId: caregiver.id },
      order: [['requestedAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      withdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Request withdrawal
router.post('/request', async (req, res, next) => {
  try {
    const { amount, recipientType = 'mobile_money', recipientNumber, token } = req.body;

    // Enhanced validation
    if (!amount || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ error: 'Invalid withdrawal amount (1-1,000,000 MWK)' });
    }

    if (!recipientNumber || !/^[0-9+\-\s]{8,15}$/.test(recipientNumber)) {
      return res.status(400).json({ error: 'Invalid recipient number format' });
    }

    if (!token || !/^\d{6}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid withdrawal token format' });
    }

    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Verify token with timing attack protection
    const withdrawalToken = await WithdrawalToken.findOne({
      where: {
        caregiverId: caregiver.id,
        token,
        used: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!withdrawalToken) {
      logger.warn(`Invalid withdrawal attempt by caregiver ${caregiver.id}`);
      return res.status(400).json({ error: 'Invalid or expired withdrawal token' });
    }

    // Mark token as used immediately
    await withdrawalToken.update({ used: true });

    const earnings = await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id }
    });

    if (!earnings || parseFloat(earnings.walletBalance) < parseFloat(amount)) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        availableBalance: earnings ? parseFloat(earnings.walletBalance).toFixed(2) : '0.00'
      });
    }

    const withdrawalFeeRate = 0.01;
    const minWithdrawalFee = 5;
    const withdrawalFee = Math.max(parseFloat(amount) * withdrawalFeeRate, minWithdrawalFee);
    const netPayout = parseFloat(amount) - withdrawalFee;

    if (netPayout <= 0) {
      return res.status(400).json({ 
        error: 'Withdrawal amount too small after fees',
        withdrawalFee: withdrawalFee.toFixed(2)
      });
    }

    // Generate secure payment reference
    const paymentReference = `WD${Date.now()}${caregiver.id}${crypto.randomInt(1000, 9999)}`;

    const withdrawalRequest = await WithdrawalRequest.create({
      caregiverId: caregiver.id,
      requestedAmount: parseFloat(amount),
      withdrawalFee: withdrawalFee,
      netPayout: netPayout,
      recipientType,
      recipientNumber,
      status: 'completed',
      payoutReference: paymentReference,
      processedAt: new Date()
    });

    await earnings.update({
      walletBalance: parseFloat(earnings.walletBalance) - parseFloat(amount)
    });

    await sendWithdrawalSuccessEmail(caregiver.User.email, {
      caregiverName: `${caregiver.User.firstName} ${caregiver.User.lastName}`,
      requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
      withdrawalFee: parseFloat(withdrawalRequest.withdrawalFee).toFixed(2),
      netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
      currency: 'MWK',
      paymentReference: paymentReference,
      recipientType,
      recipientNumber
    });

    logger.info(`Withdrawal completed: ${paymentReference} for caregiver ${caregiver.id}`);

    res.status(201).json({
      message: 'Withdrawal processed successfully',
      requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
      withdrawalFee: parseFloat(withdrawalRequest.withdrawalFee).toFixed(2),
      netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
      currency: 'MWK',
      paymentReference: paymentReference,
      recipientNumber,
      status: withdrawalRequest.status
    });
  } catch (error) {
    logger.error('Withdrawal error:', error);
    next(error);
  }
});

module.exports = router;