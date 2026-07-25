-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMINISTRATOR', 'MANAGER', 'RECEPTION') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffMember` (
    `id` CHAR(36) NOT NULL,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `jobRole` VARCHAR(100) NOT NULL,
    `profilePhotoUrl` VARCHAR(500) NULL,
    `contractedWeeklyHours` DECIMAL(5, 2) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `clockingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `cameraRequired` BOOLEAN NOT NULL DEFAULT false,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `StaffMember_email_key`(`email`),
    INDEX `StaffMember_active_displayName_idx`(`active`, `displayName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffCredential` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `kind` ENUM('PIN', 'NFC') NOT NULL,
    `valueHash` VARCHAR(191) NOT NULL,
    `lookupHash` CHAR(64) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `StaffCredential_staffId_active_idx`(`staffId`, `active`),
    UNIQUE INDEX `StaffCredential_kind_lookupHash_key`(`kind`, `lookupHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` CHAR(36) NOT NULL,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `profilePhotoUrl` VARCHAR(500) NULL,
    `expectedDays` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `fundingCategory` VARCHAR(100) NULL,
    `fundingOrganisation` VARCHAR(191) NULL,
    `internalReference` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Student_internalReference_key`(`internalReference`),
    INDEX `Student_active_displayName_idx`(`active`, `displayName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `appVersion` VARCHAR(40) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `pendingEventCount` INTEGER NOT NULL DEFAULT 0,
    `currentCursor` BIGINT NOT NULL DEFAULT 0,
    `tokenRotatedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Device_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClockEvent` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `type` ENUM('CLOCK_IN', 'CLOCK_OUT') NOT NULL,
    `deviceTimestamp` DATETIME(3) NOT NULL,
    `serverReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `offlineRecorded` BOOLEAN NOT NULL DEFAULT false,
    `photoStatus` ENUM('NOT_REQUIRED', 'CAPTURED', 'UNAVAILABLE', 'PENDING_UPLOAD') NOT NULL DEFAULT 'NOT_REQUIRED',
    `reviewRequired` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClockEvent_staffId_deviceTimestamp_idx`(`staffId`, `deviceTimestamp`),
    INDEX `ClockEvent_serverReceivedAt_idx`(`serverReceivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClockCorrection` (
    `id` CHAR(36) NOT NULL,
    `clockEventId` CHAR(36) NOT NULL,
    `managerId` CHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `originalValue` JSON NOT NULL,
    `newValue` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendancePhoto` (
    `id` CHAR(36) NOT NULL,
    `clockEventId` CHAR(36) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(80) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `AttendancePhoto_expiresAt_deletedAt_idx`(`expiresAt`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentAttendance` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE', 'CANCELLED') NOT NULL DEFAULT 'NOT_MARKED',
    `arrivalTime` DATETIME(3) NULL,
    `departureTime` DATETIME(3) NULL,
    `note` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `deviceTimestamp` DATETIME(3) NOT NULL,
    `serverReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentAttendance_date_status_idx`(`date`, `status`),
    UNIQUE INDEX `StudentAttendance_studentId_date_key`(`studentId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmergencyRollCall` (
    `id` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `startedByDeviceId` CHAR(36) NOT NULL,
    `attendanceSnapshotAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedByUserId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmergencyRollCallEntry` (
    `id` CHAR(36) NOT NULL,
    `rollCallId` CHAR(36) NOT NULL,
    `personType` VARCHAR(20) NOT NULL,
    `personId` CHAR(36) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `accountedFor` BOOLEAN NOT NULL DEFAULT false,
    `accountedAt` DATETIME(3) NULL,
    `deviceTimestamp` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmergencyRollCallEntry_rollCallId_personType_personId_key`(`rollCallId`, `personType`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncEvent` (
    `sequence` BIGINT NOT NULL AUTO_INCREMENT,
    `eventId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `operation` ENUM('CLOCK_EVENT', 'ATTENDANCE', 'ROLL_CALL_ENTRY') NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SyncEvent_eventId_key`(`eventId`),
    INDEX `SyncEvent_deviceId_sequence_idx`(`deviceId`, `sequence`),
    PRIMARY KEY (`sequence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncConflict` (
    `id` CHAR(36) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `serverValue` JSON NOT NULL,
    `incomingValue` JSON NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailySummaryEmail` (
    `id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `recipients` JSON NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `triggeredBy` VARCHAR(40) NULL,
    `triggeredByUserId` CHAR(36) NULL,
    `attemptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailySummaryEmail_date_status_idx`(`date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `actorType` VARCHAR(30) NOT NULL,
    `actorId` CHAR(36) NULL,
    `entityType` VARCHAR(50) NULL,
    `entityId` CHAR(36) NULL,
    `beforeValue` JSON NULL,
    `afterValue` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `deviceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_action_entityType_idx`(`action`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updatedBy` CHAR(36) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffCredential` ADD CONSTRAINT `StaffCredential_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClockEvent` ADD CONSTRAINT `ClockEvent_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClockEvent` ADD CONSTRAINT `ClockEvent_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClockCorrection` ADD CONSTRAINT `ClockCorrection_clockEventId_fkey` FOREIGN KEY (`clockEventId`) REFERENCES `ClockEvent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClockCorrection` ADD CONSTRAINT `ClockCorrection_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendancePhoto` ADD CONSTRAINT `AttendancePhoto_clockEventId_fkey` FOREIGN KEY (`clockEventId`) REFERENCES `ClockEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentAttendance` ADD CONSTRAINT `StudentAttendance_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentAttendance` ADD CONSTRAINT `StudentAttendance_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyRollCallEntry` ADD CONSTRAINT `EmergencyRollCallEntry_rollCallId_fkey` FOREIGN KEY (`rollCallId`) REFERENCES `EmergencyRollCall`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SyncEvent` ADD CONSTRAINT `SyncEvent_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
