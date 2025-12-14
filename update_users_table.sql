-- Add role_id column to users table
ALTER TABLE `users` ADD COLUMN `role_id` INT NOT NULL DEFAULT 1 AFTER `phone`;

-- Add foreign key constraint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update existing users to have correct role_id based on role column
UPDATE `users` SET `role_id` = 1 WHERE `role` = 'patient';
UPDATE `users` SET `role_id` = 2 WHERE `role` = 'caregiver';
UPDATE `users` SET `role_id` = 3 WHERE `role` = 'primary_physician';
UPDATE `users` SET `role_id` = 4 WHERE `role` = 'regional_manager';
UPDATE `users` SET `role_id` = 5 WHERE `role` = 'system_manager';

-- Drop the old role column
ALTER TABLE `users` DROP COLUMN `role`;