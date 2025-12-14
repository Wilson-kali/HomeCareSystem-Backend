const express = require('express');
const { verifyCaregiver, getDashboardStats } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.patch('/caregivers/:id/verify', verifyCaregiver);
router.get('/dashboard', getDashboardStats);

module.exports = router;