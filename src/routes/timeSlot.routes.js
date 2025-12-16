const express = require('express');
const router = express.Router();
const { generateTimeSlots, getAvailableSlots, getCaregiverTimeSlots, updateTimeSlotPrice, bulkUpdateTimeSlotPrices, lockSlot, unlockSlot } = require('../controllers/timeSlotController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const { USER_ROLES } = require('../utils/constants');

// Generate time slots (caregiver only)
router.post('/generate', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), generateTimeSlots);

// Get available slots (public)
router.get('/available', getAvailableSlots);

// Get caregiver's time slots (authenticated)
router.get('/caregiver/:caregiverId', authenticateToken, getCaregiverTimeSlots);

// Bulk update all available time slot prices (caregiver only) - MUST come before /:id/price
router.put('/bulk/price', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), bulkUpdateTimeSlotPrices);

// Update time slot price (caregiver only)
router.put('/:id/price', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), updateTimeSlotPrice);

// Lock slot for payment (authenticated users)
router.post('/:id/lock', authenticateToken, lockSlot);

// Unlock slot (authenticated users)
router.post('/:id/unlock', authenticateToken, unlockSlot);

module.exports = router;