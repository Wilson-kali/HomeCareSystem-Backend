const { TimeSlot, Caregiver, CaregiverAvailability, Appointment, Patient, User } = require('../models');
const { TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const generateTimeSlots = async (req, res, next) => {
  try {
    const { caregiverId, startDate, endDate } = req.body;
    
    const caregiver = await Caregiver.findByPk(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    const availability = await CaregiverAvailability.findAll({
      where: { caregiverId, isActive: true }
    });

    const slots = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

      for (const avail of dayAvailability) {
        const startTime = new Date(`${date.toDateString()} ${avail.startTime}`);
        const endTime = new Date(`${date.toDateString()} ${avail.endTime}`);
        
        while (startTime < endTime) {
          const slotEnd = new Date(startTime.getTime() + caregiver.appointmentDuration * 60000);
          
          if (slotEnd <= endTime) {
            slots.push({
              caregiverId,
              date: date.toISOString().split('T')[0],
              startTime: startTime.toTimeString().split(' ')[0],
              endTime: slotEnd.toTimeString().split(' ')[0],
              duration: caregiver.appointmentDuration,
              price: Math.round((caregiver.hourlyRate * caregiver.appointmentDuration) / 60),
              status: TIMESLOT_STATUS.AVAILABLE
            });
          }
          
          startTime.setTime(startTime.getTime() + caregiver.appointmentDuration * 60000);
        }
      }
    }

    await TimeSlot.bulkCreate(slots, { ignoreDuplicates: true });
    
    res.json({ message: 'Time slots generated successfully', count: slots.length });
  } catch (error) {
    next(error);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { caregiverId, date, includeLocked } = req.query;

    const whereClause = {
      status: TIMESLOT_STATUS.AVAILABLE,
      // Only show slots from today onwards if no specific date is provided
      date: date || { [Op.gte]: new Date().toISOString().split('T')[0] }
    };

    // Only filter by locked status if includeLocked is not set
    if (!includeLocked) {
      whereClause[Op.or] = [
        { lockedUntil: null },
        { lockedUntil: { [Op.lt]: new Date() } }
      ];
    }

    if (caregiverId) whereClause.caregiverId = caregiverId;

    const slots = await TimeSlot.findAll({
      where: whereClause,
      include: [{ model: Caregiver, attributes: ['id', 'hourlyRate'] }],
      order: [['date', 'ASC'], ['startTime', 'ASC']],
      limit: 100 // Prevent returning too many slots
    });

    // Filter out past time slots for today
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    
    const filteredSlots = slots.filter(slot => {
      if (slot.date === today) {
        return slot.startTime > currentTime;
      }
      return true;
    });

    res.json({
      slots: filteredSlots,
      count: filteredSlots.length,
      filters: {
        caregiverId: caregiverId || 'all',
        date: date || `>= ${new Date().toISOString().split('T')[0]}`,
        status: 'available'
      }
    });
  } catch (error) {
    next(error);
  }
};

const lockSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lockDuration = 10; // 10 minutes
    
    const slot = await TimeSlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    if (slot.status !== TIMESLOT_STATUS.AVAILABLE) {
      return res.status(400).json({ error: 'Time slot not available' });
    }

    const lockedUntil = new Date(Date.now() + lockDuration * 60000);
    
    await slot.update({
      status: TIMESLOT_STATUS.LOCKED,
      lockedUntil
    });

    res.json({ slot, lockedUntil });
  } catch (error) {
    next(error);
  }
};

const unlockSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const slot = await TimeSlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    await slot.update({
      status: TIMESLOT_STATUS.AVAILABLE,
      lockedUntil: null
    });

    res.json({ slot });
  } catch (error) {
    next(error);
  }
};

const getCaregiverTimeSlots = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;
    
    const slots = await TimeSlot.findAll({
      where: { caregiverId },
      include: [
        { 
          model: Appointment, 
          required: false,
          include: [
            { 
              model: Patient, 
              include: [{ model: User, attributes: ['firstName', 'lastName'] }] 
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['startTime', 'ASC']]
    });

    res.json({ slots });
  } catch (error) {
    next(error);
  }
};

const updateTimeSlotPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    
    const slot = await TimeSlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    // Verify caregiver owns this slot
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver || slot.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Not authorized to edit this time slot' });
    }

    // Can only edit available slots
    if (slot.status !== TIMESLOT_STATUS.AVAILABLE) {
      return res.status(400).json({ error: 'Can only edit available time slots' });
    }

    await slot.update({ price: Math.round(price) });
    
    res.json({ slot });
  } catch (error) {
    next(error);
  }
};

const bulkUpdateTimeSlotPrices = async (req, res, next) => {
  try {
    const { price, slotIds } = req.body;
    
    // Verify caregiver
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    let whereClause = {
      caregiverId: caregiver.id,
      status: TIMESLOT_STATUS.AVAILABLE
    };

    // If specific slot IDs provided, update only those
    if (slotIds && slotIds.length > 0) {
      whereClause.id = { [Op.in]: slotIds };
    }

    // Update slots
    const [updatedCount] = await TimeSlot.update(
      { price: Math.round(price) },
      { where: whereClause }
    );
    
    res.json({ 
      message: `Updated ${updatedCount} time slots`,
      updatedCount 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateTimeSlots,
  getAvailableSlots,
  getCaregiverTimeSlots,
  updateTimeSlotPrice,
  bulkUpdateTimeSlotPrices,
  lockSlot,
  unlockSlot
};