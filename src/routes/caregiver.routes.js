const express = require('express');
const { getCaregivers, getCaregiverById, getProfile, updateProfile, updateSpecialties } = require('../controllers/caregiverController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireCaregiver } = require('../middleware/roleCheck.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCaregivers);
router.get('/profile', requireCaregiver, getProfile);
router.get('/:id', getCaregiverById);
router.put('/profile', requireCaregiver, updateProfile);
router.put('/specialties', requireCaregiver, updateSpecialties);

module.exports = router;