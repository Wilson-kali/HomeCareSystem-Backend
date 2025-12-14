const { Specialty } = require('../models');

const getSpecialties = async (req, res, next) => {
  try {
    const specialties = await Specialty.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    res.json({ specialties });
  } catch (error) {
    next(error);
  }
};

const createSpecialty = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    const specialty = await Specialty.create({
      name,
      description
    });

    res.status(201).json({ specialty });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSpecialties,
  createSpecialty
};