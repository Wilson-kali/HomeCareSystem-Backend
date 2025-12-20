const { CareSessionReport, Appointment, Patient, Caregiver, User, Specialty } = require('../models');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const fs = require('fs').promises;

// Create or update care session report (Caregiver only)
const createOrUpdateCareReport = async (req, res, next) => {
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
      followUpDate,
      medications,
      activities,
      notes
    } = req.body;

    // Get caregiver from authenticated user
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can create care reports' });
    }

    // Verify appointment exists and belongs to this caregiver
    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized - This appointment does not belong to you' });
    }

    // Check if session fee was paid
    if (appointment.sessionFeeStatus !== 'completed') {
      return res.status(400).json({ error: 'Session fee must be paid before creating a care report' });
    }

    // Handle file uploads
    let attachmentsData = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          // Upload to cloudinary
          const uploadResult = await uploadToCloudinary(file, 'care-reports');

          // Store file metadata
          attachmentsData.push({
            filename: file.originalname,
            url: uploadResult.url,
            path: uploadResult.url,
            public_id: uploadResult.public_id,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });

          // Delete local file after upload
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Error deleting local file:', unlinkError);
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Continue with other files even if one fails
        }
      }
    }

    // Check if report already exists
    let careReport = await CareSessionReport.findOne({ where: { appointmentId } });

    // Parse vitals if it's a string
    let vitalsData = vitals;
    if (typeof vitals === 'string') {
      try {
        vitalsData = JSON.parse(vitals);
      } catch (e) {
        vitalsData = {};
      }
    }

    // If updating existing report, merge attachments
    if (careReport && careReport.attachments) {
      attachmentsData = [...careReport.attachments, ...attachmentsData];
    }

    const reportData = {
      appointmentId,
      observations,
      interventions,
      vitals: vitalsData,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired: followUpRequired || false,
      followUpDate,
      medications,
      activities,
      notes,
      attachments: attachmentsData
    };

    if (careReport) {
      // Update existing report
      await careReport.update(reportData);
    } else {
      // Create new report
      careReport = await CareSessionReport.create(reportData);
    }

    res.json({
      success: true,
      message: careReport ? 'Care report updated successfully' : 'Care report created successfully',
      careReport
    });
  } catch (error) {
    next(error);
  }
};

// Get care report by appointment ID (Caregiver or Patient)
const getCareReportByAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const careReport = await CareSessionReport.findOne({
      where: { appointmentId },
      include: [
        {
          model: Appointment,
          include: [
            { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }] },
            { model: Caregiver, include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }] },
            { model: Specialty }
          ]
        }
      ]
    });

    if (!careReport) {
      return res.status(404).json({ error: 'Care report not found' });
    }

    // Verify user has access to this report
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    const patient = await Patient.findOne({ where: { userId: req.user.id } });

    const isCaregiver = caregiver && careReport.Appointment.caregiverId === caregiver.id;
    const isPatient = patient && careReport.Appointment.patientId === patient.id;
    const isAdmin = req.user.role === 'system_manager' || req.user.role === 'regional_manager';

    if (!isCaregiver && !isPatient && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      careReport
    });
  } catch (error) {
    next(error);
  }
};

// Get all care reports for a patient (Patient or Admin)
const getPatientCareReports = async (req, res, next) => {
  try {
    let patientId;

    // If admin is requesting, get patient ID from query
    if (req.user.role === 'system_manager' || req.user.role === 'regional_manager') {
      patientId = req.query.patientId;
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
    } else {
      // Get patient from authenticated user
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (!patient) {
        return res.status(403).json({ error: 'Patient profile not found' });
      }
      patientId = patient.id;
    }

    const careReports = await CareSessionReport.findAll({
      include: [
        {
          model: Appointment,
          where: { patientId },
          include: [
            { model: Caregiver, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
            { model: Specialty, attributes: ['name'] }
          ]
        }
      ],
      order: [[{ model: Appointment }, 'scheduledDate', 'DESC']]
    });

    res.json({
      success: true,
      careReports
    });
  } catch (error) {
    next(error);
  }
};

// Get all care reports created by a caregiver (Caregiver only)
const getCaregiverCareReports = async (req, res, next) => {
  try {
    // Get caregiver from authenticated user
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }

    const careReports = await CareSessionReport.findAll({
      include: [
        {
          model: Appointment,
          where: { caregiverId: caregiver.id },
          include: [
            { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
            { model: Specialty, attributes: ['name'] }
          ]
        }
      ],
      order: [[{ model: Appointment }, 'scheduledDate', 'DESC']]
    });

    res.json({
      success: true,
      careReports
    });
  } catch (error) {
    next(error);
  }
};

// Delete care report (Caregiver only - can only delete their own reports)
const deleteCareReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get caregiver from authenticated user
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can delete care reports' });
    }

    const careReport = await CareSessionReport.findByPk(id, {
      include: [{ model: Appointment }]
    });

    if (!careReport) {
      return res.status(404).json({ error: 'Care report not found' });
    }

    // Verify this report belongs to the caregiver
    if (careReport.Appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await careReport.destroy();

    res.json({
      success: true,
      message: 'Care report deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrUpdateCareReport,
  getCareReportByAppointment,
  getPatientCareReports,
  getCaregiverCareReports,
  deleteCareReport
};
