const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Patient, Caregiver, PrimaryPhysician } = require('../models');
const { jwtSecret, jwtExpiresIn, bcryptRounds } = require('../config/auth');
const { USER_ROLES } = require('../utils/constants');
const { sanitizeUser } = require('../utils/helpers');

const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role, ...roleSpecificData } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, bcryptRounds);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role
    });

    // Create role-specific profile
    switch (role) {
      case USER_ROLES.PATIENT:
        await Patient.create({
          userId: user.id,
          ...roleSpecificData
        });
        break;
      case USER_ROLES.CAREGIVER:
        await Caregiver.create({
          userId: user.id,
          ...roleSpecificData
        });
        break;
      case USER_ROLES.PRIMARY_PHYSICIAN:
        await PrimaryPhysician.create({
          userId: user.id,
          ...roleSpecificData
        });
        break;
    }

    const token = generateToken(user.id);
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    
    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile
};