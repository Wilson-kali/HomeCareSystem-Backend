const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Patient, Caregiver, PrimaryPhysician, Role } = require('../models');
const { jwtSecret, jwtExpiresIn, bcryptRounds } = require('../config/auth');
const { USER_ROLES } = require('../utils/constants');
const { sanitizeUser } = require('../utils/helpers');

const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

const register = async (req, res, next) => {
  const transaction = await User.sequelize.transaction();
  
  try {
    const { email, password, firstName, lastName, phone, role = 'patient', ...roleSpecificData } = req.body;
    const uploadedFiles = req.files || [];

    // Find the role
    const userRole = await Role.findOne({ where: { name: role } });
    if (!userRole) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, bcryptRounds);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role_id: userRole.id,
      isActive: role !== 'caregiver' // Caregivers need approval
    }, { transaction });

    // Create role-specific profile
    switch (role) {
      case 'patient':
        await Patient.create({
          userId: user.id,
          ...roleSpecificData
        }, { transaction });
        break;
      case 'caregiver':
        // Handle document uploads for caregivers
        let documentUrls = [];
        if (uploadedFiles.length > 0) {
          const { uploadToCloudinary } = require('../services/cloudinaryService');
          for (const file of uploadedFiles.slice(0, 5)) { // Max 5 files
            try {
              const uploadResult = await uploadToCloudinary(file);
              documentUrls.push({
                url: uploadResult.url,
                public_id: uploadResult.public_id,
                filename: file.originalname,
                format: uploadResult.format
              });
            } catch (uploadError) {
              console.error('File upload failed:', uploadError);
            }
          }
        }
        
        const caregiver = await Caregiver.create({
          userId: user.id,
          licenseNumber: roleSpecificData.licenseNumber || `TEMP-${Date.now()}`,
          experience: roleSpecificData.experience || 0,
          qualifications: roleSpecificData.qualifications || 'To be updated',
          hourlyRate: roleSpecificData.hourlyRate || 50.00,
          supportingDocuments: documentUrls,
          ...roleSpecificData
        }, { transaction });
        
        // Handle specialties
        if (roleSpecificData.specialties && Array.isArray(roleSpecificData.specialties)) {
          const specialtyIds = roleSpecificData.specialties.map(id => parseInt(id));
          await caregiver.setSpecialties(specialtyIds, { transaction });
        }
        break;
      case 'primary_physician':
        await PrimaryPhysician.create({
          userId: user.id,
          ...roleSpecificData
        }, { transaction });
        break;
    }

    await transaction.commit();
    
    // Send appropriate response based on role
    if (role === 'caregiver') {
      // Send email notification to caregiver
      try {
        const emailService = require('../services/emailService');
        await emailService.sendCaregiverRegistrationNotification(user.email, user.firstName);
      } catch (emailError) {
        console.error('Failed to send registration email:', emailError);
      }
      
      res.status(201).json({
        message: 'Registration submitted. Please wait for admin approval.',
        requiresApproval: true
      });
    } else {
      const token = generateToken(user.id);
      res.status(201).json({
        message: 'Registration successful',
        token,
        user: sanitizeUser(user)
      });
    }
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const registerAdmin = async (req, res, next) => {
  const transaction = await User.sequelize.transaction();
  
  try {
    const { email, password, firstName, lastName, phone, roleName, ...roleSpecificData } = req.body;

    // Find the role
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, bcryptRounds);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role_id: role.id
    }, { transaction });

    // Create role-specific profile
    switch (roleName) {
      case 'caregiver':
        await Caregiver.create({
          userId: user.id,
          licenseNumber: roleSpecificData.licenseNumber || `TEMP-${Date.now()}`,
          experience: roleSpecificData.experience || 0,
          qualifications: roleSpecificData.qualifications || 'To be updated',
          hourlyRate: roleSpecificData.hourlyRate || 50.00,
          ...roleSpecificData
        }, { transaction });
        break;
      case 'primary_physician':
        await PrimaryPhysician.create({
          userId: user.id,
          ...roleSpecificData
        }, { transaction });
        break;
    }

    await transaction.commit();
    
    const token = generateToken(user.id);
    
    res.status(201).json({
      message: 'Admin registration successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ 
      where: { email },
      include: [{ model: Role }]
    });
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
        { model: Role, attributes: ['name'] },
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
  registerAdmin,
  login,
  getProfile
};