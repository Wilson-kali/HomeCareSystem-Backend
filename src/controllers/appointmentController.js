const { Appointment, Patient, Caregiver, User, Specialty } = require('../models');
const { APPOINTMENT_STATUS, USER_ROLES } = require('../utils/constants');
const { sendAppointmentConfirmation } = require('../services/emailService');

const createAppointment = async (req, res, next) => {
  try {
    const { caregiverId, specialtyId, scheduledDate, duration, sessionType, notes } = req.body;
    
    // Get patient ID from authenticated user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(403).json({ error: 'Only patients can create appointments' });
    }

    // Calculate total cost (simplified - in production, get from caregiver's hourly rate)
    const caregiver = await Caregiver.findByPk(caregiverId);
    const totalCost = (caregiver.hourlyRate * duration) / 60;

    const appointment = await Appointment.create({
      patientId: patient.id,
      caregiverId,
      specialtyId,
      scheduledDate,
      duration,
      sessionType,
      notes,
      totalCost
    });

    // Send confirmation email
    const appointmentDetails = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty }
      ]
    });

    await sendAppointmentConfirmation(req.user.email, {
      scheduledDate,
      caregiverName: `${appointmentDetails.Caregiver.User.firstName} ${appointmentDetails.Caregiver.User.lastName}`,
      sessionType
    });

    res.status(201).json({ appointment });
  } catch (error) {
    next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    
    if (req.user.role === USER_ROLES.PATIENT) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      whereClause.patientId = patient.id;
    } else if (req.user.role === USER_ROLES.CAREGIVER) {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
      whereClause.caregiverId = caregiver.id;
    }

    if (status) {
      whereClause.status = status;
    }

    const appointments = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['scheduledDate', 'DESC']]
    });

    res.json({
      appointments: appointments.rows,
      total: appointments.count,
      page: parseInt(page),
      totalPages: Math.ceil(appointments.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = status;
    await appointment.save();

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus
};