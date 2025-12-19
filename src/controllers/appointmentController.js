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

    // Get specialty to fetch booking and session fees
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) {
      return res.status(404).json({ error: 'Specialty not found' });
    }

    const bookingFee = specialty.bookingFee || 0;
    const sessionFee = specialty.sessionFee || 0;
    const totalCost = parseFloat(bookingFee) + parseFloat(sessionFee);

    const appointment = await Appointment.create({
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      specialtyId,
      scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
      duration: timeSlot.duration,
      sessionType,
      notes,
      bookingFee,
      sessionFee,
      totalCost,
      timeSlotId,
      bookingFeeStatus: PAYMENT_STATUS.PENDING,
      sessionFeeStatus: PAYMENT_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING, // Overall status
      bookedAt: new Date()
    });

    // Mark time slot as booked
    await timeSlot.update({
      status: TIMESLOT_STATUS.BOOKED,
      isBooked: true,
      appointmentId: appointment.id,
      lockedUntil: null
    });

    res.status(201).json({
      appointment,
      timeSlot,
      fees: {
        bookingFee,
        sessionFee,
        totalCost
      }
    });
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
      // Show appointments where at least booking fee is paid
      whereClause.bookingFeeStatus = PAYMENT_STATUS.COMPLETED;
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
    const { appointmentId, paymentType = 'booking_fee' } = req.body;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Caregiver }, { model: TimeSlot }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update payment status based on payment type
    if (paymentType === 'booking_fee') {
      appointment.bookingFeeStatus = PAYMENT_STATUS.COMPLETED;
      appointment.bookedAt = new Date();

      // Auto-confirm if caregiver has auto-confirm enabled
      if (appointment.Caregiver.autoConfirm) {
        appointment.status = APPOINTMENT_STATUS.CONFIRMED;
      }
    } else if (paymentType === 'session_fee') {
      appointment.sessionFeeStatus = PAYMENT_STATUS.COMPLETED;
      appointment.sessionPaidAt = new Date();
    }

    // Update overall payment status
    if (appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED &&
        appointment.sessionFeeStatus === PAYMENT_STATUS.COMPLETED) {
      appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    }

    await appointment.save();

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const paySessionFee = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if booking fee was paid
    if (appointment.bookingFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Booking fee must be paid first' });
    }

    // Check if session fee is already paid
    if (appointment.sessionFeeStatus === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee already paid' });
    }

    // Update session fee status
    appointment.sessionFeeStatus = PAYMENT_STATUS.COMPLETED;
    appointment.sessionPaidAt = new Date();

    // Update overall payment status
    if (appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED) {
      appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Session fee paid successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

const submitPatientFeedback = async (req, res, next) => {
  try {
    const { appointmentId, feedback, rating } = req.body;

    // Get patient from authenticated user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(403).json({ error: 'Only patients can submit feedback' });
    }

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify this appointment belongs to the patient
    if (appointment.patientId !== patient.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if session fee was paid
    if (appointment.sessionFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee must be paid before submitting feedback' });
    }

    // Update feedback
    appointment.patientFeedback = feedback;
    if (rating) {
      appointment.patientRating = rating;
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

const markAppointmentCompleted = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get caregiver from authenticated user
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can mark appointments as completed' });
    }

    const appointment = await Appointment.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify this appointment belongs to the caregiver
    if (appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if session fee was paid
    if (appointment.sessionFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee must be paid before marking as completed' });
    }

    // Mark as completed
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment marked as completed',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  confirmPayment,
  paySessionFee,
  submitPatientFeedback,
  markAppointmentCompleted
};