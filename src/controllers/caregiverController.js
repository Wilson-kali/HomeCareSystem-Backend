const { Caregiver, User, Specialty, TimeSlot, Patient, Appointment } = require('../models');
const { VERIFICATION_STATUS, TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const getCaregivers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, specialtyId, verified = true, includeAvailability } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (verified === 'true') {
      whereClause.verificationStatus = VERIFICATION_STATUS.VERIFIED;
    }

    let includeClause = [
      { model: User },
      { model: Specialty, through: { attributes: [] } }
    ];

    if (specialtyId) {
      includeClause[1].where = { id: specialtyId };
    }

    const caregivers = await Caregiver.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Add availability information if requested
    if (includeAvailability === 'true') {
      const caregiversWithAvailability = await Promise.all(
        caregivers.rows.map(async (caregiver) => {
          const availableSlots = await TimeSlot.count({
            where: {
              caregiverId: caregiver.id,
              status: TIMESLOT_STATUS.AVAILABLE,
              date: { [Op.gte]: new Date().toISOString().split('T')[0] }
            }
          });
          
          return {
            ...caregiver.toJSON(),
            hasAvailableSlots: availableSlots > 0,
            availableSlotsCount: availableSlots
          };
        })
      );
      
      return res.json({
        caregivers: caregiversWithAvailability,
        total: caregivers.count,
        page: parseInt(page),
        totalPages: Math.ceil(caregivers.count / limit)
      });
    }

    res.json({
      caregivers: caregivers.rows,
      total: caregivers.count,
      page: parseInt(page),
      totalPages: Math.ceil(caregivers.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getCaregiverById = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findByPk(req.params.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    res.json({ caregiver });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    res.json({ caregiver });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { licenseNumber, yearsOfExperience, bio, hourlyRate, availability } = req.body;

    await caregiver.update({
      licenseNumber,
      yearsOfExperience,
      bio,
      hourlyRate,
      availability
    });

    const updatedCaregiver = await Caregiver.findByPk(caregiver.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    res.json({ caregiver: updatedCaregiver });
  } catch (error) {
    next(error);
  }
};

const updateSpecialties = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { specialtyIds } = req.body;

    // Sync specialties (replaces existing with new ones)
    await caregiver.setSpecialties(specialtyIds);

    const updatedCaregiver = await Caregiver.findByPk(caregiver.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    res.json({ caregiver: updatedCaregiver });
  } catch (error) {
    next(error);
  }
};

const getMyPatients = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const appointments = await Appointment.findAll({
      where: { caregiverId: caregiver.id },
      include: [{
        model: Patient,
        include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }]
      }]
    });

    const patientsMap = new Map();
    appointments.forEach(appointment => {
      if (appointment.Patient && !patientsMap.has(appointment.Patient.id)) {
        patientsMap.set(appointment.Patient.id, appointment.Patient);
      }
    });

    const patients = Array.from(patientsMap.values());
    res.json({ patients });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCaregivers,
  getCaregiverById,
  getProfile,
  updateProfile,
  updateSpecialties,
  getMyPatients
};