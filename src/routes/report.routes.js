const express = require('express');
const { body } = require('express-validator');
const { createReport, getReports } = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireCaregiver } = require('../middleware/roleCheck.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');

const router = express.Router();

const createReportValidation = [
  body('appointmentId').isInt(),
  body('observations').trim().notEmpty(),
  body('interventions').trim().notEmpty(),
  body('patientStatus').isIn(['stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased']),
  body('sessionSummary').trim().notEmpty()
];

router.use(authenticateToken);

router.post('/', requireCaregiver, createReportValidation, handleValidationErrors, createReport);
router.get('/', getReports);

module.exports = router;