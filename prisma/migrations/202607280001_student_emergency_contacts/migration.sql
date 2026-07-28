ALTER TABLE `Student`
  ADD COLUMN `emergencyContactName` VARCHAR(120) NULL,
  ADD COLUMN `emergencyContactRelationship` VARCHAR(80) NULL,
  ADD COLUMN `emergencyContactPhone` VARCHAR(40) NULL,
  ADD COLUMN `emergencyContactAlternativePhone` VARCHAR(40) NULL,
  ADD COLUMN `emergencyContactEmail` VARCHAR(191) NULL,
  ADD COLUMN `emergencyContactNotes` TEXT NULL;
