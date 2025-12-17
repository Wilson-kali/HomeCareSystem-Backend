const express = require('express');
const { getPendingCaregivers, approveCaregiver, rejectCaregiver, getAllUsers } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');
const { sanitizeUser } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/caregivers/pending', getPendingCaregivers);
router.get('/caregivers/pending-verification', async (req, res, next) => {
  try {
    const { User, Role, Caregiver } = require('../models');
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    const pendingCaregivers = await User.findAll({
      where: { 
        role_id: caregiverRole.id
      },
      include: [
        { 
          model: Caregiver,
          where: { verificationStatus: 'pending' }
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ caregivers: pendingCaregivers.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
});
router.put('/caregivers/:userId/approve', approveCaregiver);
router.delete('/caregivers/:userId/reject', rejectCaregiver);
router.get('/users', getAllUsers);
router.get('/reports', (req, res) => {
  res.json({ 
    message: 'Admin reports endpoint',
    period: req.query.period || 'this-month'
  });
});

router.get('/users/:userId', async (req, res, next) => {
  try {
    const { User, Role, Patient, Caregiver, Specialty } = require('../models');
    const user = await User.findByPk(req.params.userId, {
      include: [
        { model: Role },
        { model: Patient, required: false },
        { 
          model: Caregiver, 
          required: false,
          include: [{ model: Specialty, through: { attributes: [] } }]
        }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:userId/toggle-status', async (req, res, next) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await user.update({ isActive: !user.isActive });
    
    res.json({ 
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', async (req, res, next) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await user.destroy();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;