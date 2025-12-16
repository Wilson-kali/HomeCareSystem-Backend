const { Appointment, Patient, Caregiver, User, Specialty, TimeSlot } = require('../models');
const { APPOINTMENT_STATUS, USER_ROLES, TIMESLOT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { sendAppointmentConfirmation } = require('../services/emailService');

const createAppointment = async (req, res, next) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes } = req.body;
    
    // Get patient ID from authenticated user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(403).json({ error: 'Only patients can create appointments' });
    }

    // Verify time slot is locked and available
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot || timeSlot.status !== TIMESLOT_STATUS.LOCKED) {
      return res.status(400).json({ error: 'Time slot not available or not locked' });
    }

    // Check if slot lock is still valid
    if (timeSlot.lockedUntil && new Date() > timeSlot.lockedUntil) {
      await timeSlot.update({ status: TIMESLOT_STATUS.AVAILABLE, lockedUntil: null });
      return res.status(400).json({ error: 'Time slot lock expired' });
    }

    const appointment = await Appointment.create({
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      specialtyId,
      scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
      duration: timeSlot.duration,
      sessionType,
      notes,
      totalCost: timeSlot.price,
      timeSlotId,
      paymentStatus: PAYMENT_STATUS.PENDING,
      bookedAt: new Date()
    });

    // Mark time slot as booked
    await timeSlot.update({
      status: TIMESLOT_STATUS.BOOKED,
      isBooked: true,
      appointmentId: appointment.id,
      lockedUntil: null
    });

    res.status(201).json({ appointment, timeSlot });
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
      whereClause.paymentStatus = PAYMENT_STATUS.COMPLETED; // Only paid appointments
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
        { model: Specialty },
        { model: TimeSlot }
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
        { model: Specialty },
        { model: TimeSlot }
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
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [{ model: TimeSlot }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = status;
    await appointment.save();

    // If cancelled, free up the time slot
    if (status === APPOINTMENT_STATUS.CANCELLED && appointment.TimeSlot) {
      await appointment.TimeSlot.update({
        status: TIMESLOT_STATUS.AVAILABLE,
        isBooked: false,
        appointmentId: null
      });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const confirmPayment = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Caregiver }, { model: TimeSlot }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update payment status
    appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    
    // Auto-confirm if caregiver has auto-confirm enabled
    if (appointment.Caregiver.autoConfirm) {
      appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    }
    
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
  updateAppointmentStatus,
  confirmPayment
};