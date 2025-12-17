const { User, Caregiver, Role } = require('../models');
const { sanitizeUser } = require('../utils/helpers');

const getPendingCaregivers = async (req, res, next) => {
  try {
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    const pendingCaregivers = await User.findAll({
      where: { 
        role_id: caregiverRole.id,
        isActive: false 
      },
      include: [
        { model: Caregiver },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ caregivers: pendingCaregivers.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
};

const approveCaregiver = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      include: [{ model: Caregiver }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update both user status and caregiver verification
    await user.update({ isActive: true });
    
    if (user.Caregiver) {
      await user.Caregiver.update({ verificationStatus: 'verified' });
    }
    
    // Send approval email to caregiver
    try {
      const emailService = require('../services/emailService');
      await emailService.sendCaregiverApprovalNotification(user.email, user.firstName);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }
    
    res.json({ 
      message: 'Caregiver verified successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const rejectCaregiver = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    
    // TODO: Send rejection email with reason
    
    res.json({ message: 'Caregiver application rejected' });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { Specialty } = require('../models');
    const users = await User.findAll({
      include: [
        { model: Role },
        { 
          model: Caregiver, 
          required: false,
          include: [{ model: Specialty, through: { attributes: [] } }]
        },
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingCaregivers,
  approveCaregiver,
  rejectCaregiver,
  getAllUsers
};