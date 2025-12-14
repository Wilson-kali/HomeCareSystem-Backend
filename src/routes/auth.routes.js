const express = require('express');
const { body } = require('express-validator');
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('role').isIn(['patient', 'caregiver', 'primary_physician'])
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

router.post('/register', registerValidation, handleValidationErrors, register);
router.post('/login', loginValidation, handleValidationErrors, login);
router.get('/profile', authenticateToken, getProfile);

module.exports = router;