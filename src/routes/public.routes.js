const express = require('express');
const { sanitizeUser } = require('../utils/helpers');

const router = express.Router();

// Get active verified caregivers
router.get('/caregivers', async (req, res, next) => {
  try {
    const { User, Role, Caregiver } = require('../models');
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    const caregivers = await User.findAll({
      where: { 
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [
        { 
          model: Caregiver,
          where: { verificationStatus: 'verified' }
        },
        { model: Role }
      ],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    const formattedCaregivers = caregivers.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      qualifications: user.Caregiver?.qualifications || 'Healthcare Professional',
      experience: user.Caregiver?.yearsOfExperience || 0,
      hourlyRate: user.Caregiver?.hourlyRate || 50000
    }));

    res.json({ 
      success: true,
      data: formattedCaregivers 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;