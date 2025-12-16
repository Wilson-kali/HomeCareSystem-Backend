const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { PaymentTransaction, Appointment, Patient, User, Caregiver } = require('../models');

const router = express.Router();

router.use(authenticateToken);

// Get earnings for caregiver
router.get('/caregiver', async (req, res, next) => {
  try {
    const { period = 'this-month' } = req.query;
    
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Get date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'this-week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        break;
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get transactions for caregiver's appointments
    const transactions = await PaymentTransaction.findAll({
      include: [
        {
          model: Appointment,
          where: { caregiverId: caregiver.id },
          include: [
            {
              model: Patient,
              include: [{ model: User, attributes: ['firstName', 'lastName'] }]
            }
          ]
        }
      ],
      where: {
        createdAt: { [require('sequelize').Op.gte]: startDate }
      },
      order: [['createdAt', 'DESC']]
    });

    // Calculate totals
    const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const thisMonth = transactions
      .filter(t => t.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const sessionsCompleted = transactions.filter(t => t.status === 'completed').length;
    const averagePerSession = sessionsCompleted > 0 ? total / sessionsCompleted : 0;

    res.json({
      total: total.toFixed(2),
      thisMonth: thisMonth.toFixed(2),
      sessionsCompleted,
      averagePerSession: averagePerSession.toFixed(2),
      transactions
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;