const { User, Patient, Caregiver, PrimaryPhysician } = require('../models');
const { sanitizeUser } = require('../utils/helpers');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, ...roleSpecificData } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    await user.update({
      firstName,
      lastName,
      phone
    });

    // Update role-specific data
    if (user.role === 'patient' && user.Patient) {
      await user.Patient.update(roleSpecificData);
    } else if (user.role === 'caregiver' && user.Caregiver) {
      await user.Caregiver.update(roleSpecificData);
    } else if (user.role === 'primary_physician' && user.PrimaryPhysician) {
      await user.PrimaryPhysician.update(roleSpecificData);
    }

    const updatedUser = await User.findByPk(req.user.id, {
      include: [
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile
};