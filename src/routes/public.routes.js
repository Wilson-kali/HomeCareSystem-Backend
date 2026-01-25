const express = require('express');
const { sanitizeUser } = require('../utils/helpers');
const { Op } = require('sequelize');

const router = express.Router();

// Get active caregivers (all verification statuses)
router.get('/caregivers', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Specialty } = require('../models');
    const { page = 1, limit = 70, specialtyId, region, district, traditionalAuthority, village, search } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    // Build where clause for User
    let userWhereClause = {
      role_id: caregiverRole.id,
      isActive: true
    };

    // Add search functionality
    if (search) {
      userWhereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Build where clause for Caregiver (location filters)
    let caregiverWhereClause = {};

    if (region) {
      caregiverWhereClause.region = region;
    }

    if (district) {
      caregiverWhereClause.district = district;
    }

    if (traditionalAuthority) {
      // Check if the JSON array contains the value
      caregiverWhereClause.traditionalAuthority = {
        [Op.like]: `%"${traditionalAuthority}"%`
      };
    }

    if (village) {
      // Check if the JSON array contains the value
      caregiverWhereClause.village = {
        [Op.like]: `%"${village}"%`
      };
    }

    // Build Specialty include with optional filtering
    let specialtyInclude = {
      model: Specialty,
      through: {
        attributes: [] // No additional attributes needed from pivot table
      },
      attributes: ['id', 'name', 'description', 'sessionFee', 'bookingFee']
    };

    // Filter by specialty if specified
    if (specialtyId) {
      specialtyInclude.where = { id: specialtyId };
      specialtyInclude.required = true; // Inner join to only get caregivers with this specialty
    }

    // Determine if Caregiver join should be required (INNER JOIN)
    // Required when: location filters are applied OR specialty filter is applied
    const hasLocationFilters = Object.keys(caregiverWhereClause).length > 0;
    const caregiverRequired = hasLocationFilters || specialtyId;

    const { count, rows: caregivers } = await User.findAndCountAll({
      where: userWhereClause,
      include: [
        {
          model: Caregiver,
          required: caregiverRequired, // INNER JOIN when filters applied, LEFT JOIN otherwise
          where: Object.keys(caregiverWhereClause).length > 0 ? caregiverWhereClause : undefined,
          attributes: [
            'id',
            'userId',
            'licenseNumber',
            'licensingInstitution',
            'experience',
            'qualifications',
            'verificationStatus',
            'hourlyRate',
            'availability',
            'bio',
            'profileImage',
            'supportingDocuments',
            'idDocuments',
            'appointmentDuration',
            'autoConfirm',
            'region',
            'district',
            'traditionalAuthority',
            'village'
          ],
          include: [specialtyInclude]
        },
        { model: Role }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      distinct: true // Ensures correct count with joins
    });

    // Return in the format the frontend expects - keep nested structure
    const formattedCaregivers = caregivers.map(user => user.toJSON());

    res.json({
      success: true,
      caregivers: formattedCaregivers,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;