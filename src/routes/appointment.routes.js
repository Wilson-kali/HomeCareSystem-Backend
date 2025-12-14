const express = require('express');
const { body } = require('express-validator');
const { 
  createAppointment, 
  getAppointments, 
  updateAppointmentStatus,
  getAppointmentById 
} = require('../controllers/appointmentController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');

const router = express.Router();

const createAppointmentValidation = [
  body('caregiverId').isInt(),
  body('specialtyId').isInt(),
  body('scheduledDate').isISO8601(),
  body('duration').isInt({ min: 30 }),
  body('sessionType').isIn(['in_person', 'teleconference'])
];

router.use(authenticateToken);

router.post('/', createAppointmentValidation, handleValidationErrors, createAppointment);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/status', updateAppointmentStatus);

module.exports = router;