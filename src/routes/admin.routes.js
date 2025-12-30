const express = require('express');
const { getPendingCaregivers, approveCaregiver, rejectCaregiver, getAllUsers, getUserStats, getAllRoles, updateUser, getAllPermissions, updateRolePermissions, createUser } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const { sanitizeUser } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/caregivers/pending', requirePermission('view_caregivers'), getPendingCaregivers);

// Get caregivers with region-based access control
router.get('/caregivers', requireAnyPermission(['view_caregivers', 'view_users']), async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Specialty } = require('../models');
    const { Op } = require('sequelize');
    
    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    let whereClause = {
      role_id: caregiverRole.id,
      isActive: true
    };
    
    let caregiverWhereClause = {};
    
    // Apply region filtering for regional managers and accountants
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        caregiverWhereClause.region = currentUser.assignedRegion;
      }
    }
    
    const caregivers = await User.findAll({
      where: whereClause,
      include: [
        {
          model: Caregiver,
          where: caregiverWhereClause,
          required: true,
          include: [
            {
              model: Specialty,
              through: { attributes: [] },
              attributes: ['id', 'name', 'description', 'sessionFee', 'bookingFee']
            }
          ]
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      caregivers: caregivers.map(sanitizeUser)
    });
  } catch (error) {
    next(error);
  }
});
router.get('/caregivers/pending-verification', requirePermission('view_caregivers'), async (req, res, next) => {
  try {
    const { User, Role, Caregiver } = require('../models');
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    const pendingCaregivers = await User.findAll({
      where: { 
        role_id: caregiverRole.id
      },
      include: [
        { 
          model: Caregiver,
          where: { verificationStatus: 'pending' }
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ caregivers: pendingCaregivers.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
});
router.put('/caregivers/:userId/approve', requirePermission('approve_caregivers'), approveCaregiver);
router.delete('/caregivers/:userId/reject', requirePermission('approve_caregivers'), rejectCaregiver);
router.get('/users', requireAnyPermission(['view_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getAllUsers);
router.post('/users', requirePermission('create_users'), createUser);
router.get('/users/stats', requireAnyPermission(['view_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getUserStats);

// Roles Management Routes
router.get('/roles', requireAnyPermission(['view_roles', 'create_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getAllRoles);

// Permissions Management Routes
router.get('/permissions', requirePermission('view_permissions'), getAllPermissions);
router.put('/roles/:roleId/permissions', requirePermission('assign_permissions'), updateRolePermissions);

router.get('/reports', (req, res) => {
  res.json({
    message: 'Admin reports endpoint',
    period: req.query.period || 'this-month'
  });
});

// Analytics: Appointments by Specialty
router.get('/analytics/specialty-appointments', async (req, res, next) => {
  try {
    const { Appointment, Specialty, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const specialtyStats = await Appointment.findAll({
      attributes: [
        'specialtyId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('totalCost')), 'avgRevenue']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      include: [{
        model: Specialty,
        attributes: ['id', 'name', 'sessionFee', 'bookingFee']
      }],
      group: ['specialtyId', 'Specialty.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      data: specialtyStats,
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Top Caregivers by Appointments
router.get('/analytics/top-caregivers', async (req, res, next) => {
  try {
    const { Appointment, User, Caregiver, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month', limit = 10 } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const topCaregivers = await Appointment.findAll({
      attributes: [
        'caregiverId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalEarnings']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      include: [{
        model: Caregiver,
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      }],
      group: ['caregiverId', 'Caregiver.id', 'Caregiver.User.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'DESC']],
      limit: parseInt(limit),
      raw: false
    });

    res.json({
      success: true,
      data: topCaregivers,
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Appointment Statistics
router.get('/analytics/appointment-stats', async (req, res, next) => {
  try {
    const { Appointment, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const stats = await Appointment.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalAmount']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      group: ['status'],
      raw: true
    });

    const total = await Appointment.count({
      where: {
        createdAt: { [Op.gte]: startDate }
      }
    });

    const totalRevenue = await Appointment.sum('totalCost', {
      where: {
        createdAt: { [Op.gte]: startDate },
        status: 'completed'
      }
    });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        totalRevenue: totalRevenue || 0
      },
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Revenue by Specialty
router.get('/analytics/revenue-by-specialty', async (req, res, next) => {
  try {
    const { Appointment, Specialty, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const revenueStats = await Appointment.findAll({
      attributes: [
        'specialtyId',
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount']
      ],
      where: {
        createdAt: { [Op.gte]: startDate },
        status: 'completed'
      },
      include: [{
        model: Specialty,
        attributes: ['id', 'name', 'sessionFee', 'bookingFee']
      }],
      group: ['specialtyId', 'Specialty.id'],
      order: [[sequelize.fn('SUM', sequelize.col('totalCost')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      data: revenueStats,
      period
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:userId', requireAnyPermission(['view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), async (req, res, next) => {
  try {
    const { User, Role, Patient, Caregiver, Specialty } = require('../models');
    
    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    const user = await User.findByPk(req.params.userId, {
      include: [
        { model: Role },
        { model: Patient, required: false },
        {
          model: Caregiver,
          required: false,
          include: [{ model: Specialty, through: { attributes: [] } }]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check region access for regional managers and accountants
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        const userRegion = user.Patient?.region || user.Caregiver?.region;
        if (userRegion && userRegion !== currentUser.assignedRegion) {
          return res.status(403).json({ error: 'Access denied - user not in your assigned region' });
        }
      }
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:userId', requireAnyPermission(['edit_caregivers', 'edit_patients', 'edit_accountants', 'edit_regional_managers']), updateUser);

// Get caregiver appointments with patient and transaction details
router.get('/caregivers/:caregiverId/appointments', requirePermission('view_caregivers'), async (req, res, next) => {
  try {
    const { Appointment, Patient, User, Specialty, PaymentTransaction } = require('../models');
    const { caregiverId } = req.params;

    const appointments = await Appointment.findAll({
      where: { caregiverId },
      include: [
        {
          model: Patient,
          include: [{
            model: User,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          }]
        },
        {
          model: Specialty,
          attributes: ['id', 'name']
        },
        {
          model: PaymentTransaction,
          required: false,
          attributes: ['id', 'amount', 'status', 'stripePaymentIntentId', 'createdAt']
        }
      ],
      order: [['scheduledDate', 'DESC']]
    });

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    next(error);
  }
});

// Get unique patients served by caregiver
router.get('/caregivers/:caregiverId/patients', async (req, res, next) => {
  try {
    const { Appointment, Patient, User, sequelize } = require('../models');
    const { caregiverId } = req.params;

    const patients = await Appointment.findAll({
      where: { caregiverId },
      attributes: [
        'patientId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('MAX', sequelize.col('Appointment.scheduledDate')), 'lastAppointment']
      ],
      include: [{
        model: Patient,
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }]
      }],
      group: ['patientId', 'Patient.id', 'Patient.User.id'],
      order: [[sequelize.fn('MAX', sequelize.col('Appointment.scheduledDate')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    next(error);
  }
});

// Get caregiver transactions
router.get('/caregivers/:caregiverId/transactions', async (req, res, next) => {
  try {
    const { Appointment, PaymentTransaction, Patient, User, Specialty } = require('../models');
    const { caregiverId } = req.params;

    const transactions = await PaymentTransaction.findAll({
      include: [{
        model: Appointment,
        where: { caregiverId },
        include: [
          {
            model: Patient,
            include: [{
              model: User,
              attributes: ['id', 'firstName', 'lastName', 'email']
            }]
          },
          {
            model: Specialty,
            attributes: ['id', 'name']
          }
        ]
      }],
      order: [['createdAt', 'DESC']]
    });

    const totalEarnings = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    res.json({
      success: true,
      transactions,
      totalEarnings
    });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:userId/toggle-status', async (req, res, next) => {
  try {
    const { User, Role } = require('../models');
    const user = await User.findByPk(req.params.userId, {
      include: [{ model: Role }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const wasInactive = !user.isActive;
    await user.update({ isActive: !user.isActive });
    
    // Queue approval email if caregiver is being activated
    if (wasInactive && user.isActive && user.Role?.name === 'caregiver') {
      const EmailScheduler = require('../services/emailScheduler');
      await EmailScheduler.queueEmail(user.email, 'caregiver_approval', {
        email: user.email,
        firstName: user.firstName
      });
    }
    
    res.json({ 
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', async (req, res, next) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Location-wise statistics for caregivers
router.get('/analytics/caregivers-by-location', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, sequelize } = require('../models');
    const { groupBy = 'region' } = req.query; // region, district, traditionalAuthority, village

    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    let groupFields = [];
    let selectFields = [];

    if (groupBy === 'region' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`region`'));
      selectFields.push([sequelize.col('Caregiver.region'), 'region']);
    }
    if (groupBy === 'district' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`district`'));
      selectFields.push([sequelize.col('Caregiver.district'), 'district']);
    }
    if (groupBy === 'traditionalAuthority' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`traditional_authority`'));
      selectFields.push([sequelize.literal('`Caregiver`.`traditional_authority`'), 'traditionalAuthority']);
    }
    if (groupBy === 'village' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`village`'));
      selectFields.push([sequelize.col('Caregiver.village'), 'village']);
    }

    // Default to region if nothing specified
    if (groupFields.length === 0) {
      groupFields = [sequelize.literal('`Caregiver`.`region`')];
      selectFields = [[sequelize.col('Caregiver.region'), 'region']];
    }

    const locationStats = await User.findAll({
      attributes: [
        ...selectFields,
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'caregiverCount']
      ],
      where: {
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [{
        model: Caregiver,
        attributes: [],
        where: {
          verificationStatus: 'verified'
        }
      }],
      group: groupFields,
      order: [[sequelize.fn('COUNT', sequelize.col('User.id')), 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      data: locationStats,
      groupBy
    });
  } catch (error) {
    console.error('Caregivers by location error:', error.message);
    console.error('Full error:', error);
    next(error);
  }
});

// Location-wise statistics for patients
router.get('/analytics/patients-by-location', async (req, res, next) => {
  try {
    const { User, Role, Patient, sequelize } = require('../models');
    const { groupBy = 'region' } = req.query;

    const patientRole = await Role.findOne({ where: { name: 'patient' } });

    let groupFields = [];
    let selectFields = [];

    if (groupBy === 'region' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`region`'));
      selectFields.push([sequelize.col('Patient.region'), 'region']);
    }
    if (groupBy === 'district' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`district`'));
      selectFields.push([sequelize.col('Patient.district'), 'district']);
    }
    if (groupBy === 'traditionalAuthority' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`traditional_authority`'));
      selectFields.push([sequelize.literal('`Patient`.`traditional_authority`'), 'traditionalAuthority']);
    }
    if (groupBy === 'village' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`village`'));
      selectFields.push([sequelize.col('Patient.village'), 'village']);
    }

    if (groupFields.length === 0) {
      groupFields = [sequelize.literal('`Patient`.`region`')];
      selectFields = [[sequelize.col('Patient.region'), 'region']];
    }

    const locationStats = await User.findAll({
      attributes: [
        ...selectFields,
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'patientCount']
      ],
      where: {
        role_id: patientRole.id,
        isActive: true
      },
      include: [{
        model: Patient,
        attributes: [],
        required: true
      }],
      group: groupFields,
      order: [[sequelize.fn('COUNT', sequelize.col('User.id')), 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      data: locationStats,
      groupBy
    });
  } catch (error) {
    console.error('Patients by location error:', error.message);
    console.error('Full error:', error);
    next(error);
  }
});

// Combined location statistics
router.get('/analytics/location-summary', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Patient, sequelize } = require('../models');

    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    const patientRole = await Role.findOne({ where: { name: 'patient' } });

    // Get caregivers by region
    const caregiversByRegion = await User.findAll({
      attributes: [
        [sequelize.col('Caregiver.region'), 'region'],
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'count']
      ],
      where: {
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [{
        model: Caregiver,
        attributes: [],
        where: { verificationStatus: 'verified' }
      }],
      group: [sequelize.literal('`Caregiver`.`region`')],
      raw: true
    });

    // Get patients by region
    const patientsByRegion = await User.findAll({
      attributes: [
        [sequelize.col('Patient.region'), 'region'],
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'count']
      ],
      where: {
        role_id: patientRole.id,
        isActive: true
      },
      include: [{
        model: Patient,
        attributes: [],
        required: true
      }],
      group: [sequelize.literal('`Patient`.`region`')],
      raw: true
    });

    // Combine data by region
    const regionMap = new Map();

    caregiversByRegion.forEach(item => {
      if (item.region) {
        regionMap.set(item.region, {
          region: item.region,
          caregivers: parseInt(item.count) || 0,
          patients: 0
        });
      }
    });

    patientsByRegion.forEach(item => {
      if (item.region) {
        if (regionMap.has(item.region)) {
          regionMap.get(item.region).patients = parseInt(item.count) || 0;
        } else {
          regionMap.set(item.region, {
            region: item.region,
            caregivers: 0,
            patients: parseInt(item.count) || 0
          });
        }
      }
    });

    const summary = Array.from(regionMap.values())
      .sort((a, b) => (b.caregivers + b.patients) - (a.caregivers + a.patients));

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;