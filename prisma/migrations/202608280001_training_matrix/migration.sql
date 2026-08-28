CREATE TABLE `TrainingProvider` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(40) NULL,
  `website` VARCHAR(500) NULL,
  `bookingNotes` TEXT NULL,
  `credentialsSummary` TEXT NULL,
  `accreditationBody` VARCHAR(191) NULL,
  `accreditationReference` VARCHAR(191) NULL,
  `accreditationExpiry` DATE NULL,
  `evidenceReference` VARCHAR(500) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` CHAR(36) NOT NULL,
  `updatedById` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TrainingProvider_name_key`(`name`),
  INDEX `TrainingProvider_active_name_idx`(`active`, `name`),
  INDEX `TrainingProvider_accreditationExpiry_active_idx`(`accreditationExpiry`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TrainingCourse` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `renewalMonths` INTEGER NULL,
  `warningDays` INTEGER NOT NULL DEFAULT 60,
  `requirementRules` JSON NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` CHAR(36) NULL,
  `updatedById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TrainingCourse_name_key`(`name`),
  INDEX `TrainingCourse_active_category_name_idx`(`active`, `category`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TrainingCourseProvider` (
  `courseId` CHAR(36) NOT NULL,
  `providerId` CHAR(36) NOT NULL,
  `preferred` BOOLEAN NOT NULL DEFAULT false,
  `bookingReference` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  INDEX `TrainingCourseProvider_providerId_idx`(`providerId`),
  PRIMARY KEY (`courseId`, `providerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StaffTrainingRecord` ADD COLUMN `courseId` CHAR(36) NULL,
  ADD COLUMN `providerId` CHAR(36) NULL,
  ADD INDEX `StaffTrainingRecord_courseId_active_idx`(`courseId`, `active`),
  ADD INDEX `StaffTrainingRecord_providerId_active_idx`(`providerId`, `active`);

ALTER TABLE `StaffTrainingRecord` ADD CONSTRAINT `StaffTrainingRecord_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `TrainingCourse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `StaffTrainingRecord` ADD CONSTRAINT `StaffTrainingRecord_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `TrainingProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TrainingCourseProvider` ADD CONSTRAINT `TrainingCourseProvider_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `TrainingCourse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TrainingCourseProvider` ADD CONSTRAINT `TrainingCourseProvider_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `TrainingProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

