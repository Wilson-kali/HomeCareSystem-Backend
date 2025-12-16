const express = require('express');
const router = express.Router();
const { setAvailability, getAvailability } = require('../controllers/availabilityController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const { USER_ROLES } = require('../utils/constants');

// Set caregiver availability
router.post('/', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), setAvailability);

// Get caregiver availability
router.get('/:caregiverId', getAvailability);

module.exports = router;