const { Caregiver, User, Appointment, Patient } = require('../models');
const { VERIFICATION_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');

const verifyCaregiver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const caregiver = await Caregiver.findByPk(id);
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    caregiver.verificationStatus = status;
    await caregiver.save();

    res.json({ 
      message: `Caregiver ${status} successfully`,
      caregiver 
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const totalCaregivers = await Caregiver.count();
    const verifiedCaregivers = await Caregiver.count({
      where: { verificationStatus: VERIFICATION_STATUS.VERIFIED }
    });
    const pendingVerifications = await Caregiver.count({
      where: { verificationStatus: VERIFICATION_STATUS.PENDING }
    });
    
    const totalPatients = await Patient.count();
    const totalAppointments = await Appointment.count();
    const completedAppointments = await Appointment.count({
      where: { status: APPOINTMENT_STATUS.COMPLETED }
    });

    res.json({
      stats: {
        totalCaregivers,
        verifiedCaregivers,
        pendingVerifications,
        totalPatients,
        totalAppointments,
        completedAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyCaregiver,
  getDashboardStats
};