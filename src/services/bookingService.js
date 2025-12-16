const { TimeSlot, Appointment, Caregiver } = require('../models');
const { TIMESLOT_STATUS, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');

class BookingService {
  async lockSlotForBooking(timeSlotId, lockDurationMinutes = 10) {
    const slot = await TimeSlot.findByPk(timeSlotId);
    
    if (!slot || slot.status !== TIMESLOT_STATUS.AVAILABLE) {
      throw new Error('Time slot not available');
    }

    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60000);
    
    await slot.update({
      status: TIMESLOT_STATUS.LOCKED,
      lockedUntil
    });

    return { slot, lockedUntil };
  }

  async createBookingWithPayment(bookingData) {
    const { timeSlotId, patientId, specialtyId, sessionType, notes } = bookingData;
    
    // Verify slot is locked
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot || timeSlot.status !== TIMESLOT_STATUS.LOCKED) {
      throw new Error('Time slot not locked or unavailable');
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
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

    return appointment;
  }

  async confirmBookingPayment(appointmentId) {
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Caregiver }, { model: TimeSlot }]
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Update payment status
    appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    
    // Auto-confirm if caregiver allows it
    if (appointment.Caregiver.autoConfirm) {
      appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    }
    
    await appointment.save();

    // Mark time slot as booked
    await appointment.TimeSlot.update({
      status: TIMESLOT_STATUS.BOOKED,
      isBooked: true,
      appointmentId: appointment.id,
      lockedUntil: null
    });

    return appointment;
  }

  async releaseExpiredLocks() {
    const expiredSlots = await TimeSlot.findAll({
      where: {
        status: TIMESLOT_STATUS.LOCKED,
        lockedUntil: { [require('sequelize').Op.lt]: new Date() }
      }
    });

    for (const slot of expiredSlots) {
      await slot.update({
        status: TIMESLOT_STATUS.AVAILABLE,
        lockedUntil: null
      });
    }

    return expiredSlots.length;
  }
}

module.exports = new BookingService();