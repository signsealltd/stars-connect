ALTER TABLE `TrainingCourse` ADD COLUMN `policy` JSON NULL;
ALTER TABLE `StaffTrainingRecord` ADD COLUMN `evidenceDetails` JSON NULL;
ALTER TABLE `StaffTrainingAssignment` ADD COLUMN `policy` JSON NULL;
ALTER TABLE `TrainingIntegration` ADD COLUMN `certificatesEnabled` BOOLEAN NOT NULL DEFAULT false, ADD COLUMN `syncPaused` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `TrainingExternalResult` ADD COLUMN `completionTimestamp` VARCHAR(50) NULL;
ALTER TABLE `TrainingIntegration` ADD COLUMN `rebuildVersion` VARCHAR(100) NULL;
