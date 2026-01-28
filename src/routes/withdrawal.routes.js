const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { CaregiverEarnings, WithdrawalRequest, Caregiver, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

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
    const { amount, recipientType = 'mobile_money', recipientNumber } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!recipientNumber) {
      return res.status(400).json({ error: 'Recipient number is required' });
    }

    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'phone'] }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Get earnings record
    const earnings = await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id }
    });

    if (!earnings || parseFloat(earnings.walletBalance) < parseFloat(amount)) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        availableBalance: earnings ? parseFloat(earnings.walletBalance).toFixed(2) : '0.00'
      });
    }

    // Calculate withdrawal fee (example: 1% or minimum 5 MWK)
    const withdrawalFeeRate = 0.01; // 1%
    const minWithdrawalFee = 5; // 5 MWK minimum
    const withdrawalFee = Math.max(parseFloat(amount) * withdrawalFeeRate, minWithdrawalFee);
    const netPayout = parseFloat(amount) - withdrawalFee;

    if (netPayout <= 0) {
      return res.status(400).json({ 
        error: 'Withdrawal amount too small after fees',
        withdrawalFee: withdrawalFee.toFixed(2)
      });
    }

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      caregiverId: caregiver.id,
      requestedAmount: parseFloat(amount),
      withdrawalFee: withdrawalFee,
      netPayout: netPayout,
      recipientType,
      recipientNumber,
      status: 'pending'
    });

    logger.info(`Withdrawal request created: ${withdrawalRequest.id} for caregiver ${caregiver.id}`);

    res.status(201).json({
      message: 'Withdrawal request submitted successfully',
      withdrawalRequest: {
        id: withdrawalRequest.id,
        requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
        withdrawalFee: parseFloat(withdrawalRequest.withdrawalFee).toFixed(2),
        netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;