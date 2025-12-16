const bcrypt = require('bcryptjs');
const { User, Role } = require('../models');
const { bcryptRounds } = require('../config/auth');

const createAdminUsers = async () => {
  try {
    // Create System Manager
    const systemManagerRole = await Role.findOne({ where: { name: 'system_manager' } });
    const regionalManagerRole = await Role.findOne({ where: { name: 'regional_manager' } });

    if (!systemManagerRole || !regionalManagerRole) {
      console.error('Admin roles not found. Please run migrations first.');
      return;
    }

    const hashedPassword = await bcrypt.hash('brian001', bcryptRounds);

    // Create System Manager
    const existingSystemManager = await User.findOne({ 
      where: { email: 'admin@careconnect.com' } 
    });

    if (!existingSystemManager) {
      await User.create({
        email: 'admin@careconnect.com',
        password: hashedPassword,
        firstName: 'Brian',
        lastName: 'Albert',
        phone: '+1234567890',
        role_id: systemManagerRole.id,
        isActive: true
      });
      console.log('System Manager created: admin@careconnect.com / brian001');
    } else {
      console.log('System Manager already exists: admin@careconnect.com');
    }

    // Create Regional Manager
    const existingRegionalManager = await User.findOne({ 
      where: { email: 'regional@homecare.com' } 
    });

    if (!existingRegionalManager) {
      await User.create({
        email: 'regional@homecare.com',
        password: hashedPassword,
        firstName: 'hillary',
        lastName: 'machuge',
        phone: '+1234567891',
        role_id: regionalManagerRole.id,
        isActive: true
      });
      console.log('Regional Manager created: regional@homecare.com / brian001');
    } else {
      console.log('Regional Manager already exists: regional@homecare.com');
    }

    console.log('Admin users setup completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin users:', error);
    process.exit(1);
  }
};

createAdminUsers();