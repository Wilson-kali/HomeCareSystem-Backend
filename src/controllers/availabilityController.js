const { CaregiverAvailability, Caregiver } = require('../models');
const { Op } = require('sequelize');

// Helper function to validate time slot
const validateTimeSlot = (slot) => {
  const errors = [];

  if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
    errors.push('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
  }

  if (!slot.startTime || !slot.endTime) {
    errors.push('startTime and endTime are required');
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(slot.startTime)) {
    errors.push('Invalid startTime format. Use HH:MM');
  }
  if (!timeRegex.test(slot.endTime)) {
    errors.push('Invalid endTime format. Use HH:MM');
  }

  // Validate startTime < endTime
  if (slot.startTime >= slot.endTime) {
    errors.push('startTime must be before endTime');
  }

  return errors;
};

// Helper function to check for time conflicts
const checkTimeConflicts = async (caregiverId, dayOfWeek, startTime, endTime, excludeId = null) => {
  const whereClause = {
    caregiverId,
    dayOfWeek,
    isActive: true,
    [Op.or]: [
      {
        // New slot starts during existing slot
        startTime: { [Op.lte]: startTime },
        endTime: { [Op.gt]: startTime }
      },
      {
        // New slot ends during existing slot
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gte]: endTime }
      },
      {
        // New slot completely contains existing slot
        startTime: { [Op.gte]: startTime },
        endTime: { [Op.lte]: endTime }
      }
    ]
  };

  if (excludeId) {
    whereClause.id = { [Op.ne]: excludeId };
  }

  const conflicts = await CaregiverAvailability.findAll({ where: whereClause });
  return conflicts;
};

// CREATE - Add single availability slot
const createAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body;

    console.log('📅 Creating availability slot:', { dayOfWeek, startTime, endTime, userId: req.user.id });

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      console.log('❌ Caregiver not found for userId:', req.user.id);
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    console.log('✅ Found caregiver:', {
      id: caregiver.id,
      userId: caregiver.userId,
      dataValues: caregiver.dataValues
    });

    if (!caregiver.id || caregiver.id === 0) {
      console.log('❌ Invalid caregiver ID:', caregiver.id);
      return res.status(500).json({
        error: 'Invalid caregiver record - ID is missing or zero. Please check your database.',
        caregiverId: caregiver.id,
        userId: caregiver.userId
      });
    }

    // Validate input
    const validationErrors = validateTimeSlot({ dayOfWeek, startTime, endTime });
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors: validationErrors });
    }

    // Check for conflicts
    const conflicts = await checkTimeConflicts(caregiver.id, dayOfWeek, startTime, endTime);
    if (conflicts.length > 0) {
      return res.status(400).json({
        error: 'Time slot conflicts with existing availability',
        conflicts: conflicts.map(c => ({
          id: c.id,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime
        }))
      });
    }

    const availability = await CaregiverAvailability.create({
      caregiverId: caregiver.id,
      dayOfWeek,
      startTime,
      endTime,
      isActive: true
    });

    console.log('✅ Created availability slot:', availability.id);
    res.status(201).json({ availability });
  } catch (error) {
    console.error('❌ Error creating availability:', error);
    next(error);
  }
};

// READ - Get all availability for a caregiver
const getAvailability = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;

    console.log('📖 Getting availability for caregiver:', caregiverId);

    const availability = await CaregiverAvailability.findAll({
      where: { caregiverId, isActive: true },
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    console.log(`✅ Found ${availability.length} availability slots`);
    res.json({ availability });
  } catch (error) {
    console.error('❌ Error getting availability:', error);
    next(error);
  }
};

// UPDATE - Update single availability slot
const updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime } = req.body;

    console.log('📝 Updating availability slot:', id, { dayOfWeek, startTime, endTime });

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      console.log('❌ Caregiver not found for userId:', req.user.id);
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    const slot = await CaregiverAvailability.findOne({
      where: { id, caregiverId: caregiver.id }
    });

    if (!slot) {
      console.log('❌ Availability slot not found:', id);
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    // Validate input
    const validationErrors = validateTimeSlot({ dayOfWeek, startTime, endTime });
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors: validationErrors });
    }

    // Check for conflicts (excluding current slot)
    const conflicts = await checkTimeConflicts(caregiver.id, dayOfWeek, startTime, endTime, id);
    if (conflicts.length > 0) {
      return res.status(400).json({
        error: 'Time slot conflicts with existing availability',
        conflicts: conflicts.map(c => ({
          id: c.id,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime
        }))
      });
    }

    await slot.update({ dayOfWeek, startTime, endTime });

    console.log('✅ Updated availability slot:', id);
    res.json({ availability: slot });
  } catch (error) {
    console.error('❌ Error updating availability:', error);
    next(error);
  }
};

// DELETE - Delete single availability slot
const deleteAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting availability slot:', id, 'for userId:', req.user.id);

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      console.log('❌ Caregiver not found for userId:', req.user.id);
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    console.log('✅ Found caregiver:', {
      id: caregiver.id,
      userId: caregiver.userId,
      dataValues: caregiver.dataValues
    });

    if (!caregiver.id || caregiver.id === 0) {
      console.log('❌ Invalid caregiver ID:', caregiver.id);
      return res.status(500).json({
        error: 'Invalid caregiver record - ID is missing or zero. Please check your database.',
        caregiverId: caregiver.id,
        userId: caregiver.userId
      });
    }

    const deleted = await CaregiverAvailability.destroy({
      where: { id, caregiverId: caregiver.id }
    });

    if (deleted === 0) {
      console.log('❌ Availability slot not found or already deleted:', id);
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    console.log('✅ Deleted availability slot:', id);
    res.json({ message: 'Availability slot deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting availability:', error);
    next(error);
  }
};

// BULK SET - Replace all availability (legacy support)
const setAvailability = async (req, res, next) => {
  try {
    const { availability } = req.body; // Array of { dayOfWeek, startTime, endTime }

    console.log('📦 Bulk setting availability:', availability?.length || 0, 'slots for userId:', req.user.id);

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      console.log('❌ Caregiver not found for userId:', req.user.id);
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    console.log('✅ Found caregiver:', {
      id: caregiver.id,
      userId: caregiver.userId,
      dataValues: caregiver.dataValues
    });

    if (!caregiver.id || caregiver.id === 0) {
      console.log('❌ Invalid caregiver ID:', caregiver.id);
      return res.status(500).json({
        error: 'Invalid caregiver record - ID is missing or zero. Please check your database.',
        caregiverId: caregiver.id,
        userId: caregiver.userId
      });
    }

    // Validate all slots first
    for (let i = 0; i < availability.length; i++) {
      const validationErrors = validateTimeSlot(availability[i]);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: `Validation failed for slot ${i + 1}`,
          errors: validationErrors
        });
      }
    }

    // Clear existing availability
    const deletedCount = await CaregiverAvailability.destroy({ where: { caregiverId: caregiver.id } });
    console.log(`🗑️ Deleted ${deletedCount} existing availability slots`);

    // Create new availability if any
    if (availability.length > 0) {
      const availabilityData = availability.map(slot => ({
        caregiverId: caregiver.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: true
      }));

      const created = await CaregiverAvailability.bulkCreate(availabilityData);
      console.log(`✅ Created ${created.length} new availability slots`);

      res.json({
        message: 'Availability updated successfully',
        deleted: deletedCount,
        created: created.length
      });
    } else {
      console.log('✅ Cleared all availability (no new slots to create)');
      res.json({
        message: 'All availability cleared successfully',
        deleted: deletedCount,
        created: 0
      });
    }
  } catch (error) {
    console.error('❌ Error setting availability:', error);
    next(error);
  }
};

// CLEAR ALL - Delete all availability for caregiver
const clearAllAvailability = async (req, res, next) => {
  try {
    console.log('🧹 Clearing all availability for userId:', req.user.id);

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      console.log('❌ Caregiver not found for userId:', req.user.id);
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    console.log('✅ Found caregiver:', {
      id: caregiver.id,
      userId: caregiver.userId,
      dataValues: caregiver.dataValues
    });

    if (!caregiver.id || caregiver.id === 0) {
      console.log('❌ Invalid caregiver ID:', caregiver.id);
      return res.status(500).json({
        error: 'Invalid caregiver record - ID is missing or zero. Please check your database.',
        caregiverId: caregiver.id,
        userId: caregiver.userId
      });
    }

    const deletedCount = await CaregiverAvailability.destroy({
      where: { caregiverId: caregiver.id }
    });

    console.log(`✅ Deleted ${deletedCount} availability slots`);

    res.json({
      message: 'All availability cleared successfully',
      deleted: deletedCount
    });
  } catch (error) {
    console.error('❌ Error clearing availability:', error);
    next(error);
  }
};

module.exports = {
  createAvailability,
  getAvailability,
  updateAvailability,
  deleteAvailability,
  setAvailability,
  clearAllAvailability
};