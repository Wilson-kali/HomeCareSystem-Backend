const express = require('express');
const { sanitizeUser } = require('../utils/helpers');

const router = express.Router();

// Get active caregivers (all verification statuses)
router.get('/caregivers', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Specialty } = require('../models');
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    const caregivers = await User.findAll({
      where: {
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [
        {
          model: Caregiver,
          required: false, // Left join to include all users even without caregiver profile
          include: [
            {
              model: Specialty,
              through: {
                attributes: [] // No additional attributes needed from pivot table
              },
              attributes: ['id', 'name', 'description', 'sessionFee', 'bookingFee']
            }
          ]
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Return in the format the frontend expects - keep nested structure
    const formattedCaregivers = caregivers.map(user => user.toJSON());

    res.json({
      success: true,
      caregivers: formattedCaregivers // Changed from 'data' to 'caregivers'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;