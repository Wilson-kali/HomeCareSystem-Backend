const { CareSessionReport, Appointment, Patient, Caregiver, User } = require('../models');
const { createStatusAlert } = require('../services/notificationService');
const { PATIENT_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');

const createReport = async (req, res, next) => {
  try {
    const {
      appointmentId,
      observations,
      interventions,
      vitals,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired,
      attachments
    } = req.body;

    // Verify appointment exists and belongs to caregiver
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Patient, include: [{ model: User }] }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const report = await CareSessionReport.create({
      appointmentId,
      observations,
      interventions,
      vitals,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired,
      attachments
    });

    // Update appointment status to completed
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();

    // Create status alert if needed
    if ([PATIENT_STATUS.DETERIORATING, PATIENT_STATUS.CRITICAL, PATIENT_STATUS.DECEASED].includes(patientStatus)) {
      await createStatusAlert(
        appointment.patientId,
        report.id,
        patientStatus,
        {
          name: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
          emergencyContactEmail: appointment.Patient.emergencyContact
        }
      );
    }

    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, patientId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (patientId) {
      whereClause['$Appointment.patientId$'] = patientId;
    }

    const reports = await CareSessionReport.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Appointment,
          include: [
            { model: Patient, include: [{ model: User }] }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      reports: reports.rows,
      total: reports.count,
      page: parseInt(page),
      totalPages: Math.ceil(reports.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getReportById = async (req, res, next) => {
  try {
    const report = await CareSessionReport.findByPk(req.params.id, {
      include: [
        {
          model: Appointment,
          include: [
            { model: Patient, include: [{ model: User }] },
            { model: Caregiver, include: [{ model: User }] }
          ]
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById
};