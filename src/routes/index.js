const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const caregiverRoutes = require('./caregiver.routes');
const appointmentRoutes = require('./appointment.routes');
const reportRoutes = require('./report.routes');
const teleconferenceRoutes = require('./teleconference.routes');
const specialtyRoutes = require('./specialty.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/caregivers', caregiverRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reports', reportRoutes);
router.use('/teleconference', teleconferenceRoutes);
router.use('/specialties', specialtyRoutes);
router.use('/admin', adminRoutes);

module.exports = router;