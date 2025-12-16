const { CaregiverAvailability, Caregiver } = require('../models');

const setAvailability = async (req, res, next) => {
  try {
    const { availability } = req.body; // Array of { dayOfWeek, startTime, endTime }
    
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can set availability' });
    }

    // Clear existing availability
    await CaregiverAvailability.destroy({ where: { caregiverId: caregiver.id } });

    // Create new availability
    const availabilityData = availability.map(slot => ({
      caregiverId: caregiver.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: true
    }));

    await CaregiverAvailability.bulkCreate(availabilityData);

    res.json({ message: 'Availability updated successfully' });
  } catch (error) {
    next(error);
  }
};

const getAvailability = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;
    
    const availability = await CaregiverAvailability.findAll({
      where: { caregiverId, isActive: true },
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    res.json({ availability });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setAvailability,
  getAvailability
};