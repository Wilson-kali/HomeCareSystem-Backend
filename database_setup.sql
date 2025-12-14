-- Create tables
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `role_id` (`role_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Insert roles
INSERT INTO `roles` (`name`, `description`, `createdAt`, `updatedAt`) VALUES
('patient', 'Patient role with basic access', NOW(), NOW()),
('caregiver', 'Caregiver role with care management access', NOW(), NOW()),
('primary_physician', 'Primary physician role with medical oversight', NOW(), NOW()),
('regional_manager', 'Regional manager role with regional oversight', NOW(), NOW()),
('system_manager', 'System manager role with full system access', NOW(), NOW());

-- Insert permissions
INSERT INTO `permissions` (`name`, `description`, `createdAt`, `updatedAt`) VALUES
('view_dashboard', 'View dashboard', NOW(), NOW()),
('manage_appointments', 'Create and manage appointments', NOW(), NOW()),
('view_appointments', 'View appointments', NOW(), NOW()),
('manage_patients', 'Manage patient records', NOW(), NOW()),
('view_patients', 'View patient records', NOW(), NOW()),
('manage_caregivers', 'Manage caregiver records', NOW(), NOW()),
('view_caregivers', 'View caregiver records', NOW(), NOW()),
('manage_reports', 'Create and manage care reports', NOW(), NOW()),
('view_reports', 'View care reports', NOW(), NOW()),
('manage_users', 'Manage system users', NOW(), NOW()),
('view_users', 'View system users', NOW(), NOW()),
('system_admin', 'Full system administration', NOW(), NOW());

-- Assign permissions to roles
-- Patient permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `createdAt`, `updatedAt`) VALUES
(1, 1, NOW(), NOW()), -- view_dashboard
(1, 3, NOW(), NOW()), -- view_appointments
(1, 7, NOW(), NOW()), -- view_caregivers
(1, 9, NOW(), NOW()); -- view_reports

-- Caregiver permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `createdAt`, `updatedAt`) VALUES
(2, 1, NOW(), NOW()), -- view_dashboard
(2, 2, NOW(), NOW()), -- manage_appointments
(2, 3, NOW(), NOW()), -- view_appointments
(2, 5, NOW(), NOW()), -- view_patients
(2, 8, NOW(), NOW()), -- manage_reports
(2, 9, NOW(), NOW()); -- view_reports

-- Primary physician permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `createdAt`, `updatedAt`) VALUES
(3, 1, NOW(), NOW()), -- view_dashboard
(3, 3, NOW(), NOW()), -- view_appointments
(3, 4, NOW(), NOW()), -- manage_patients
(3, 5, NOW(), NOW()), -- view_patients
(3, 7, NOW(), NOW()), -- view_caregivers
(3, 8, NOW(), NOW()), -- manage_reports
(3, 9, NOW(), NOW()); -- view_reports

-- Regional manager permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `createdAt`, `updatedAt`) VALUES
(4, 1, NOW(), NOW()), -- view_dashboard
(4, 2, NOW(), NOW()), -- manage_appointments
(4, 3, NOW(), NOW()), -- view_appointments
(4, 4, NOW(), NOW()), -- manage_patients
(4, 5, NOW(), NOW()), -- view_patients
(4, 6, NOW(), NOW()), -- manage_caregivers
(4, 7, NOW(), NOW()), -- view_caregivers
(4, 8, NOW(), NOW()), -- manage_reports
(4, 9, NOW(), NOW()), -- view_reports
(4, 11, NOW(), NOW()); -- view_users

-- System manager permissions (all permissions)
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `createdAt`, `updatedAt`) VALUES
(5, 1, NOW(), NOW()), -- view_dashboard
(5, 2, NOW(), NOW()), -- manage_appointments
(5, 3, NOW(), NOW()), -- view_appointments
(5, 4, NOW(), NOW()), -- manage_patients
(5, 5, NOW(), NOW()), -- view_patients
(5, 6, NOW(), NOW()), -- manage_caregivers
(5, 7, NOW(), NOW()), -- view_caregivers
(5, 8, NOW(), NOW()), -- manage_reports
(5, 9, NOW(), NOW()), -- view_reports
(5, 10, NOW(), NOW()), -- manage_users
(5, 11, NOW(), NOW()), -- view_users
(5, 12, NOW(), NOW()); -- system_admin