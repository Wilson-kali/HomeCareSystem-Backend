const { Caregiver, User, Specialty } = require('../models');
const { VERIFICATION_STATUS } = require('../utils/constants');

const getCaregivers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, specialtyId, verified = true } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (verified === 'true') {
      whereClause.verificationStatus = VERIFICATION_STATUS.VERIFIED;
    }

    let includeClause = [
      { model: User },
      { model: Specialty, through: { attributes: [] } }
    ];

    if (specialtyId) {
      includeClause[1].where = { id: specialtyId };
    }

    const caregivers = await Caregiver.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      caregivers: caregivers.rows,
      total: caregivers.count,
      page: parseInt(page),
      totalPages: Math.ceil(caregivers.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getCaregiverById = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findByPk(req.params.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    res.json({ caregiver });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCaregivers,
  getCaregiverById
};