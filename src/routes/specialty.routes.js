const express = require('express');
const { getSpecialties, createSpecialty } = require('../controllers/specialtyController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');

const router = express.Router();

router.get('/', getSpecialties);
router.post('/', authenticateToken, requireAdmin, createSpecialty);

module.exports = router;