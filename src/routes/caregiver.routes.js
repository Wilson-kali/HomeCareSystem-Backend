const express = require('express');
const { getCaregivers, getCaregiverById } = require('../controllers/caregiverController');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCaregivers);
router.get('/:id', getCaregiverById);

module.exports = router;