const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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
    const { email, password, firstName, lastName, phone, idNumber, role = 'patient', ...roleSpecificData } = req.body;
    const uploadedFiles = req.files || {};

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
      idNumber,
      role_id: userRole.id,
      isActive: role !== 'caregiver' // Caregivers need approval
    }, { transaction });

    // Get the user ID from the database since Sequelize isn't returning it properly
    const createdUser = await User.findOne({ 
      where: { email },
      transaction 
    });
    
    console.log('User created:', { id: createdUser?.id, email: createdUser?.email });

    // Ensure user was created and has an ID
    if (!createdUser || !createdUser.id) {
      console.error('User creation failed - no ID');
      await transaction.rollback();
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Create role-specific profile
    switch (role) {
      case 'patient':
        const patientData = {
          userId: parseInt(createdUser.id),
          dateOfBirth: roleSpecificData.dateOfBirth,
          address: roleSpecificData.address,
          emergencyContact: roleSpecificData.emergencyContact,
          medicalHistory: roleSpecificData.medicalHistory,
          currentMedications: roleSpecificData.currentMedications,
          allergies: roleSpecificData.allergies,
          region: roleSpecificData.region,
          district: roleSpecificData.district,
          traditionalAuthority: roleSpecificData.traditionalAuthority,
          village: roleSpecificData.village,
          patientType: roleSpecificData.patientType === 'child_patient' ? 'child' : 
                      roleSpecificData.patientType === 'elderly_patient' ? 'elderly' : 'adult',
          guardianFirstName: roleSpecificData.guardianFirstName,
          guardianLastName: roleSpecificData.guardianLastName,
          guardianPhone: roleSpecificData.guardianPhone,
          guardianEmail: roleSpecificData.guardianEmail,
          guardianRelationship: roleSpecificData.guardianRelationship,
          guardianIdNumber: roleSpecificData.guardianIdNumber
        };
        
        console.log('Creating patient with userId:', patientData.userId);
        await Patient.create(patientData, { transaction });
        break;
      case 'caregiver':
        // Handle document uploads for caregivers
        let documentUrls = [];
        let profilePictureUrl = null;
        let idDocumentUrls = [];
        
        if (Object.keys(uploadedFiles).length > 0) {
          const { uploadToCloudinary } = require('../services/cloudinaryService');
          
          // Handle supporting documents (max 5)
          if (uploadedFiles.supportingDocuments) {
            for (const file of uploadedFiles.supportingDocuments.slice(0, 5)) {
              try {
                const uploadResult = await uploadToCloudinary(file, 'caregiver-documents');
                documentUrls.push({
                  url: uploadResult.url,
                  public_id: uploadResult.public_id,
                  filename: file.originalname,
                  format: uploadResult.format
                });
              } catch (uploadError) {
                console.error('Supporting document upload failed:', uploadError);
              }
            }
          }
          
          // Handle profile picture (single file)
          if (uploadedFiles.profilePicture && uploadedFiles.profilePicture[0]) {
            try {
              const uploadResult = await uploadToCloudinary(uploadedFiles.profilePicture[0], 'caregiver-profiles');
              profilePictureUrl = uploadResult.url; // Store just the URL string
            } catch (uploadError) {
              console.error('Profile picture upload failed:', uploadError);
            }
          }
          
          // Handle ID documents (max 3)
          if (uploadedFiles.idDocuments) {
            for (const file of uploadedFiles.idDocuments.slice(0, 3)) {
              try {
                const uploadResult = await uploadToCloudinary(file, 'caregiver-ids');
                idDocumentUrls.push({
                  url: uploadResult.url,
                  public_id: uploadResult.public_id,
                  filename: file.originalname,
                  format: uploadResult.format
                });
              } catch (uploadError) {
                console.error('ID document upload failed:', uploadError);
              }
            }
          }
        }
        
        const caregiver = await Caregiver.create({
          userId: createdUser.id,
          licensingInstitution: roleSpecificData.licensingInstitution,
          licenseNumber: roleSpecificData.licenseNumber || `TEMP-${Date.now()}`,
          experience: roleSpecificData.experience || 0,
          qualifications: roleSpecificData.qualifications || 'To be updated',
          hourlyRate: roleSpecificData.hourlyRate || 50.00,
          appointmentDuration: parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 180,
          supportingDocuments: documentUrls.length > 0 ? documentUrls : null,
          profileImage: profilePictureUrl,
          idDocuments: idDocumentUrls.length > 0 ? idDocumentUrls : null,
          bio: roleSpecificData.bio,
          region: roleSpecificData.region,
          district: roleSpecificData.district,
          traditionalAuthority: roleSpecificData.traditionalAuthority,
          village: roleSpecificData.village
        }, { transaction });
        
        // Handle specialties - get the created caregiver with ID
        const createdCaregiver = await Caregiver.findOne({
          where: { userId: createdUser.id },
          transaction
        });
        
        if (roleSpecificData.specialties && Array.isArray(roleSpecificData.specialties) && createdCaregiver) {
          const specialtyIds = roleSpecificData.specialties.map(id => parseInt(id));
          await createdCaregiver.setSpecialties(specialtyIds, { transaction });
        }
        break;
      case 'primary_physician':
        await PrimaryPhysician.create({
          userId: createdUser.id,
          ...roleSpecificData
        }, { transaction });
        break;
    }

    await transaction.commit();
    
    // Send appropriate response based on role
    if (role === 'caregiver') {
      // Queue email notification to caregiver
      const EmailScheduler = require('../services/emailScheduler');
      await EmailScheduler.queueEmail(createdUser.email, 'caregiver_registration', {
        email: createdUser.email,
        firstName: createdUser.firstName
      });
      
      res.status(201).json({
        message: 'Registration submitted. Please wait for admin approval.',
        requiresApproval: true
      });
    } else {
      const token = generateToken(createdUser.id);
      res.status(201).json({
        message: 'Registration successful',
        token,
        user: sanitizeUser(createdUser)
      });
    }
  } catch (error) {
    console.error('Registration error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      sql: error.sql,
      parameters: error.parameters
    });
    await transaction.rollback();
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
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
    const { Permission } = require('../models');

    const user = await User.findOne({ 
      where: { email },
      include: [{
        model: Role,
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      }]
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    const sanitizedUser = sanitizeUser(user);
    
    // Add permissions to user object
    sanitizedUser.permissions = user.Role?.Permissions?.map(p => p.name) || [];
    
    res.json({
      message: 'Login successful',
      token,
      user: sanitizedUser
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { Permission } = require('../models');
    
    const user = await User.findByPk(req.user.id, {
      include: [
        { 
          model: Role, 
          attributes: ['name'],
          include: [{
            model: Permission,
            through: { attributes: [] }
          }]
        },
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    const sanitizedUser = sanitizeUser(user);
    // Add permissions to user object
    sanitizedUser.permissions = user.Role?.Permissions?.map(p => p.name) || [];

    res.json({ user: sanitizedUser });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('🔐 Forgot password request for:', email);

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('⚠️ User not found for email:', email);
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    console.log('✅ User found:', user.firstName, user.lastName);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    console.log('🔑 Generated reset token:', resetToken.substring(0, 10) + '...');
    console.log('⏰ Token expires at:', resetTokenExpiry);

    // Save token to user
    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetTokenExpiry
    });

    console.log('💾 Token saved to database');

    // Queue email with reset link
    const EmailScheduler = require('../services/emailScheduler');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await EmailScheduler.queueEmail(user.email, 'password_reset', {
      email: user.email,
      firstName: user.firstName,
      resetUrl
    });

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('💥 Forgot password error:', error);
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, bcryptRounds);

    // Update user password and clear reset token
    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  registerAdmin,
  login,
  getProfile,
  forgotPassword,
  resetPassword
};