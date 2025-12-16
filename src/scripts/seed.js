const { sequelize, Role, Permission, RolePermission, Specialty } = require('../models');

async function seedDatabase() {
  try {
    console.log('🔄 Seeding database with initial data...');
    
    // Ensure database connection is open
    await sequelize.authenticate();

    // Seed Roles
    const roles = await Role.bulkCreate([
      { name: 'patient', description: 'Patient role with basic access' },
      { name: 'caregiver', description: 'Caregiver role with care management access' },
      { name: 'primary_physician', description: 'Primary physician role with medical oversight' },
      { name: 'regional_manager', description: 'Regional manager role with regional oversight' },
      { name: 'system_manager', description: 'System manager role with full system access' }
    ], { ignoreDuplicates: true });

    // Seed Permissions
    const permissions = await Permission.bulkCreate([
      { name: 'view_dashboard', description: 'View dashboard' },
      { name: 'manage_appointments', description: 'Create and manage appointments' },
      { name: 'view_appointments', description: 'View appointments' },
      { name: 'manage_patients', description: 'Manage patient records' },
      { name: 'view_patients', description: 'View patient records' },
      { name: 'manage_caregivers', description: 'Manage caregiver records' },
      { name: 'view_caregivers', description: 'View caregiver records' },
      { name: 'manage_reports', description: 'Create and manage care reports' },
      { name: 'view_reports', description: 'View care reports' },
      { name: 'manage_users', description: 'Manage system users' },
      { name: 'view_users', description: 'View system users' },
      { name: 'system_admin', description: 'Full system administration' }
    ], { ignoreDuplicates: true });

    // Assign permissions to roles
    const rolePermissions = [
      // Patient permissions (role_id: 1)
      { role_id: 1, permission_id: 1 }, // view_dashboard
      { role_id: 1, permission_id: 3 }, // view_appointments
      { role_id: 1, permission_id: 7 }, // view_caregivers
      { role_id: 1, permission_id: 9 }, // view_reports
      
      // Caregiver permissions (role_id: 2)
      { role_id: 2, permission_id: 1 }, // view_dashboard
      { role_id: 2, permission_id: 2 }, // manage_appointments
      { role_id: 2, permission_id: 3 }, // view_appointments
      { role_id: 2, permission_id: 5 }, // view_patients
      { role_id: 2, permission_id: 8 }, // manage_reports
      { role_id: 2, permission_id: 9 }, // view_reports
      
      // Primary physician permissions (role_id: 3)
      { role_id: 3, permission_id: 1 }, // view_dashboard
      { role_id: 3, permission_id: 3 }, // view_appointments
      { role_id: 3, permission_id: 4 }, // manage_patients
      { role_id: 3, permission_id: 5 }, // view_patients
      { role_id: 3, permission_id: 7 }, // view_caregivers
      { role_id: 3, permission_id: 8 }, // manage_reports
      { role_id: 3, permission_id: 9 }, // view_reports
      
      // Regional manager permissions (role_id: 4)
      { role_id: 4, permission_id: 1 }, // view_dashboard
      { role_id: 4, permission_id: 2 }, // manage_appointments
      { role_id: 4, permission_id: 3 }, // view_appointments
      { role_id: 4, permission_id: 4 }, // manage_patients
      { role_id: 4, permission_id: 5 }, // view_patients
      { role_id: 4, permission_id: 6 }, // manage_caregivers
      { role_id: 4, permission_id: 7 }, // view_caregivers
      { role_id: 4, permission_id: 8 }, // manage_reports
      { role_id: 4, permission_id: 9 }, // view_reports
      { role_id: 4, permission_id: 11 }, // view_users
      
      // System manager permissions (role_id: 5) - all permissions
      { role_id: 5, permission_id: 1 }, // view_dashboard
      { role_id: 5, permission_id: 2 }, // manage_appointments
      { role_id: 5, permission_id: 3 }, // view_appointments
      { role_id: 5, permission_id: 4 }, // manage_patients
      { role_id: 5, permission_id: 5 }, // view_patients
      { role_id: 5, permission_id: 6 }, // manage_caregivers
      { role_id: 5, permission_id: 7 }, // view_caregivers
      { role_id: 5, permission_id: 8 }, // manage_reports
      { role_id: 5, permission_id: 9 }, // view_reports
      { role_id: 5, permission_id: 10 }, // manage_users
      { role_id: 5, permission_id: 11 }, // view_users
      { role_id: 5, permission_id: 12 }  // system_admin
    ];
    
    await RolePermission.bulkCreate(rolePermissions, { ignoreDuplicates: true });

    // Seed Specialties
    await Specialty.bulkCreate([
      { name: 'General Care', description: 'General healthcare and assistance' },
      { name: 'Elderly Care', description: 'Specialized care for elderly patients' },
      { name: 'Pediatric Care', description: 'Healthcare for children' },
      { name: 'Mental Health', description: 'Mental health support and counseling' },
      { name: 'Physical Therapy', description: 'Physical rehabilitation and therapy' },
      { name: 'Nursing Care', description: 'Professional nursing services' }
    ], { ignoreDuplicates: true });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase().finally(() => sequelize.close());
}

module.exports = seedDatabase;