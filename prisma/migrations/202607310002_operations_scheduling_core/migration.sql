-- CreateTable
CREATE TABLE `StaffWorkingPattern` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `effectiveStart` DATE NOT NULL,
    `effectiveEnd` DATE NULL,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'Europe/London',
    `cycleWeeks` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `createdById` CHAR(36) NOT NULL,
    `approvedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StaffWorkingPattern_organisationId_staffId_active_effectiveS_idx`(`organisationId`, `staffId`, `active`, `effectiveStart`),
    UNIQUE INDEX `StaffWorkingPattern_organisationId_staffId_version_key`(`organisationId`, `staffId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffWorkingPatternInterval` (
    `id` CHAR(36) NOT NULL,
    `patternId` CHAR(36) NOT NULL,
    `weekIndex` INTEGER NOT NULL DEFAULT 1,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `breakMinutes` INTEGER NOT NULL DEFAULT 0,
    `premisesName` VARCHAR(191) NULL,
    `defaultRole` VARCHAR(100) NULL,
    `notes` TEXT NULL,

    INDEX `StaffWorkingPatternInterval_patternId_dayOfWeek_idx`(`patternId`, `dayOfWeek`),
    UNIQUE INDEX `StaffWorkingPatternInterval_patternId_weekIndex_dayOfWeek_st_key`(`patternId`, `weekIndex`, `dayOfWeek`, `startTime`, `endTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffScheduleOccurrence` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `patternId` CHAR(36) NULL,
    `patternIntervalId` CHAR(36) NULL,
    `date` DATE NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `expectedClockInFrom` DATETIME(3) NOT NULL,
    `expectedClockInUntil` DATETIME(3) NOT NULL,
    `expectedClockOutFrom` DATETIME(3) NOT NULL,
    `expectedClockOutUntil` DATETIME(3) NOT NULL,
    `premisesName` VARCHAR(191) NULL,
    `role` VARCHAR(100) NULL,
    `status` ENUM('SCHEDULED', 'CHANGED', 'LEAVE', 'SICKNESS', 'TRAINING', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `manuallyModified` BOOLEAN NOT NULL DEFAULT false,
    `generationKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffScheduleOccurrence_generationKey_key`(`generationKey`),
    INDEX `StaffScheduleOccurrence_organisationId_date_status_idx`(`organisationId`, `date`, `status`),
    INDEX `StaffScheduleOccurrence_organisationId_staffId_startAt_endAt_idx`(`organisationId`, `staffId`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffScheduleException` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `replacementStaffId` CHAR(36) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `startTime` VARCHAR(5) NULL,
    `endTime` VARCHAR(5) NULL,
    `type` ENUM('ANNUAL_LEAVE', 'SICKNESS', 'TRAINING', 'UNPAID_LEAVE', 'TEMPORARY_HOURS', 'OVERTIME', 'ADDITIONAL_SHIFT', 'SHIFT_SWAP', 'NON_WORKING_DAY', 'APPOINTMENT', 'OTHER') NOT NULL,
    `paid` BOOLEAN NOT NULL DEFAULT false,
    `approvalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `createdById` CHAR(36) NOT NULL,
    `approvedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StaffScheduleException_organisationId_staffId_startDate_endD_idx`(`organisationId`, `staffId`, `startDate`, `endDate`),
    INDEX `StaffScheduleException_organisationId_approvalStatus_type_idx`(`organisationId`, `approvalStatus`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Operation` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `internalNotes` TEXT NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Operation_organisationId_type_createdAt_idx`(`organisationId`, `type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationSeries` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `recurrenceRule` JSON NOT NULL,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'Europe/London',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OperationSeries_operationId_key`(`operationId`),
    INDEX `OperationSeries_organisationId_active_idx`(`organisationId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationOccurrence` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `seriesId` CHAR(36) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `allDay` BOOLEAN NOT NULL DEFAULT false,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'Europe/London',
    `location` VARCHAR(191) NULL,
    `premisesName` VARCHAR(191) NULL,
    `roomName` VARCHAR(120) NULL,
    `requiredStaffCount` INTEGER NOT NULL DEFAULT 0,
    `requiresCompliance` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PLANNING', 'AWAITING_APPROVAL', 'STAFFING_INCOMPLETE', 'COMPLIANCE_INCOMPLETE', 'CHECKS_INCOMPLETE', 'READY', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'POST_OPERATION_REVIEW') NOT NULL DEFAULT 'DRAFT',
    `readiness` ENUM('READY', 'ACTION_REQUIRED', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'ACTION_REQUIRED',
    `leadManagerId` CHAR(36) NULL,
    `leadStaffId` CHAR(36) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperationOccurrence_organisationId_startAt_endAt_status_idx`(`organisationId`, `startAt`, `endAt`, `status`),
    INDEX `OperationOccurrence_organisationId_readiness_startAt_idx`(`organisationId`, `readiness`, `startAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationStaffAssignment` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `occurrenceId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `responsibility` VARCHAR(120) NULL,
    `lead` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ASSIGNED', 'REPLACEMENT_REQUIRED', 'REMOVED') NOT NULL DEFAULT 'ASSIGNED',
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperationStaffAssignment_organisationId_staffId_status_idx`(`organisationId`, `staffId`, `status`),
    UNIQUE INDEX `OperationStaffAssignment_occurrenceId_staffId_key`(`occurrenceId`, `staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationAttendee` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `occurrenceId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `status` ENUM('PLANNED', 'CONFIRMED', 'WAITLISTED', 'ABSENT', 'PRESENT', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `transportMode` VARCHAR(80) NULL,
    `supportLevel` VARCHAR(80) NULL,
    `operationalNotes` VARCHAR(500) NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperationAttendee_organisationId_studentId_status_idx`(`organisationId`, `studentId`, `status`),
    UNIQUE INDEX `OperationAttendee_occurrenceId_studentId_key`(`occurrenceId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpectedStaffAttendance` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `scheduleOccurrenceId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `expectedStartAt` DATETIME(3) NOT NULL,
    `expectedEndAt` DATETIME(3) NOT NULL,
    `state` ENUM('EXPECTED', 'CLOCKED_IN', 'LATE', 'ABSENT_APPROVED', 'MISSING_CLOCK_IN', 'MISSING_CLOCK_OUT', 'CLOCKED_OUT', 'NOT_SCHEDULED', 'REVIEW_REQUIRED', 'RESOLVED') NOT NULL DEFAULT 'EXPECTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExpectedStaffAttendance_scheduleOccurrenceId_key`(`scheduleOccurrenceId`),
    INDEX `ExpectedStaffAttendance_organisationId_date_state_idx`(`organisationId`, `date`, `state`),
    INDEX `ExpectedStaffAttendance_organisationId_staffId_expectedStart_idx`(`organisationId`, `staffId`, `expectedStartAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceReconciliation` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `expectedAttendanceId` CHAR(36) NOT NULL,
    `clockInEventId` CHAR(36) NULL,
    `clockOutEventId` CHAR(36) NULL,
    `state` ENUM('EXPECTED', 'CLOCKED_IN', 'LATE', 'ABSENT_APPROVED', 'MISSING_CLOCK_IN', 'MISSING_CLOCK_OUT', 'CLOCKED_OUT', 'NOT_SCHEDULED', 'REVIEW_REQUIRED', 'RESOLVED') NOT NULL,
    `minutesLate` INTEGER NOT NULL DEFAULT 0,
    `minutesShort` INTEGER NOT NULL DEFAULT 0,
    `resolutionReason` VARCHAR(500) NULL,
    `resolvedById` CHAR(36) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AttendanceReconciliation_expectedAttendanceId_key`(`expectedAttendanceId`),
    INDEX `AttendanceReconciliation_organisationId_state_calculatedAt_idx`(`organisationId`, `state`, `calculatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationReadinessSnapshot` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `occurrenceId` CHAR(36) NOT NULL,
    `level` ENUM('READY', 'ACTION_REQUIRED', 'BLOCKED', 'CANCELLED') NOT NULL,
    `blockers` JSON NOT NULL,
    `warnings` JSON NOT NULL,
    `calculatedById` CHAR(36) NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OperationReadinessSnapshot_organisationId_occurrenceId_calcu_idx`(`organisationId`, `occurrenceId`, `calculatedAt`),
    INDEX `OperationReadinessSnapshot_organisationId_level_calculatedAt_idx`(`organisationId`, `level`, `calculatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StaffWorkingPattern` ADD CONSTRAINT `StaffWorkingPattern_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffWorkingPattern` ADD CONSTRAINT `StaffWorkingPattern_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffWorkingPatternInterval` ADD CONSTRAINT `StaffWorkingPatternInterval_patternId_fkey` FOREIGN KEY (`patternId`) REFERENCES `StaffWorkingPattern`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleOccurrence` ADD CONSTRAINT `StaffScheduleOccurrence_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleOccurrence` ADD CONSTRAINT `StaffScheduleOccurrence_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleOccurrence` ADD CONSTRAINT `StaffScheduleOccurrence_patternId_fkey` FOREIGN KEY (`patternId`) REFERENCES `StaffWorkingPattern`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleOccurrence` ADD CONSTRAINT `StaffScheduleOccurrence_patternIntervalId_fkey` FOREIGN KEY (`patternIntervalId`) REFERENCES `StaffWorkingPatternInterval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleException` ADD CONSTRAINT `StaffScheduleException_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleException` ADD CONSTRAINT `StaffScheduleException_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffScheduleException` ADD CONSTRAINT `StaffScheduleException_replacementStaffId_fkey` FOREIGN KEY (`replacementStaffId`) REFERENCES `StaffMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationSeries` ADD CONSTRAINT `OperationSeries_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationSeries` ADD CONSTRAINT `OperationSeries_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationOccurrence` ADD CONSTRAINT `OperationOccurrence_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationOccurrence` ADD CONSTRAINT `OperationOccurrence_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationOccurrence` ADD CONSTRAINT `OperationOccurrence_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `OperationSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationStaffAssignment` ADD CONSTRAINT `OperationStaffAssignment_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationStaffAssignment` ADD CONSTRAINT `OperationStaffAssignment_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `OperationOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationStaffAssignment` ADD CONSTRAINT `OperationStaffAssignment_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationAttendee` ADD CONSTRAINT `OperationAttendee_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationAttendee` ADD CONSTRAINT `OperationAttendee_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `OperationOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationAttendee` ADD CONSTRAINT `OperationAttendee_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpectedStaffAttendance` ADD CONSTRAINT `ExpectedStaffAttendance_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpectedStaffAttendance` ADD CONSTRAINT `ExpectedStaffAttendance_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpectedStaffAttendance` ADD CONSTRAINT `ExpectedStaffAttendance_scheduleOccurrenceId_fkey` FOREIGN KEY (`scheduleOccurrenceId`) REFERENCES `StaffScheduleOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceReconciliation` ADD CONSTRAINT `AttendanceReconciliation_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceReconciliation` ADD CONSTRAINT `AttendanceReconciliation_expectedAttendanceId_fkey` FOREIGN KEY (`expectedAttendanceId`) REFERENCES `ExpectedStaffAttendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationReadinessSnapshot` ADD CONSTRAINT `OperationReadinessSnapshot_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationReadinessSnapshot` ADD CONSTRAINT `OperationReadinessSnapshot_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `OperationOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
