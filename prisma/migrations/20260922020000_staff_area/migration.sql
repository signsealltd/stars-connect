-- AlterTable
ALTER TABLE `OperationOccurrence` ADD COLUMN `staffConfirmationRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `staffVisibleNotes` TEXT NULL;

-- AlterTable
ALTER TABLE `OperationStaffAssignment` ADD COLUMN `confirmation` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `responseNote` TEXT NULL;

-- CreateTable
CREATE TABLE `StaffPortalAccount` (
    `staffId` CHAR(36) NOT NULL,
    `pinHash` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `invitationHash` CHAR(64) NULL,
    `invitationExpiresAt` DATETIME(3) NULL,
    `profile` JSON NULL,
    `preferences` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffPortalAccount_invitationHash_key`(`invitationHash`),
    PRIMARY KEY (`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffPortalSession` (
    `id` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StaffPortalSession_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffPasskey` (
    `id` CHAR(64) NOT NULL,
    `credentialId` TEXT NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `publicKey` BLOB NOT NULL,
    `counter` BIGINT NOT NULL DEFAULT 0,
    `transports` JSON NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffAuthChallenge` (
    `id` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `challenge` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(20) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffAuthChallenge_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffRequest` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `idempotencyKey` CHAR(36) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'NEW',
    `details` JSON NOT NULL,
    `involvedUserIds` JSON NOT NULL,
    `assignedUserId` CHAR(36) NULL,
    `dueDate` DATETIME(3) NULL,
    `absenceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffRequest_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `StaffRequest_absenceId_key`(`absenceId`),
    INDEX `StaffRequest_organisationId_type_status_idx`(`organisationId`, `type`, `status`),
    INDEX `StaffRequest_staffId_createdAt_idx`(`staffId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffRequestEvent` (
    `id` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `message` TEXT NOT NULL,
    `staffVisible` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StaffRequestEvent_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffPrivateDocument` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StaffPrivateDocument_staffId_expiresAt_idx`(`staffId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffPortalNotification` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `href` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StaffPortalNotification_key_key`(`key`),
    INDEX `StaffPortalNotification_staffId_readAt_idx`(`staffId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffAccessEvent` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NULL,
    `action` VARCHAR(60) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StaffAccessEvent_staffId_createdAt_idx`(`staffId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StaffPortalAccount` ADD CONSTRAINT `StaffPortalAccount_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffPortalSession` ADD CONSTRAINT `StaffPortalSession_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `StaffPortalAccount`(`staffId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffPasskey` ADD CONSTRAINT `StaffPasskey_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `StaffPortalAccount`(`staffId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffRequest` ADD CONSTRAINT `StaffRequest_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffRequestEvent` ADD CONSTRAINT `StaffRequestEvent_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `StaffRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffPrivateDocument` ADD CONSTRAINT `StaffPrivateDocument_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `StaffRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
