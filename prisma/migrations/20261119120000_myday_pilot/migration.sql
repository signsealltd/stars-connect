-- CreateTable
CREATE TABLE `MyDaySession` (
    `id` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `credentialId` CHAR(36) NOT NULL,
    `credentialHash` VARCHAR(255) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MyDaySession_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayGrant` (
    `id` CHAR(36) NOT NULL,
    `secretHash` CHAR(64) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `credentialId` CHAR(36) NOT NULL,
    `credentialHash` VARCHAR(255) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayClient` (
    `studentId` CHAR(36) NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayActivity` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MyDayActivity_organisationId_archived_position_idx`(`organisationId`, `archived`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayEntry` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `authorId` CHAR(36) NOT NULL,
    `authorName` VARCHAR(191) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `day` CHAR(10) NOT NULL,
    `content` JSON NOT NULL,
    `handover` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `editedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MyDayEntry_organisationId_studentId_day_idx`(`organisationId`, `studentId`, `day`),
    INDEX `MyDayEntry_organisationId_day_handover_idx`(`organisationId`, `day`, `handover`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayRevision` (
    `id` CHAR(36) NOT NULL,
    `requestKey` CHAR(36) NOT NULL,
    `entryId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` JSON NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MyDayRevision_requestKey_key`(`requestKey`),
    INDEX `MyDayRevision_entryId_version_idx`(`entryId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayReview` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    `decidedBy` CHAR(36) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MyDayReview_organisationId_status_idx`(`organisationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayPlanHistory` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `section` VARCHAR(80) NOT NULL,
    `beforeText` TEXT NOT NULL,
    `afterText` TEXT NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MyDayPlanHistory_organisationId_studentId_createdAt_idx`(`organisationId`, `studentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyDayReport` (
    `studentId` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `month` CHAR(7) NOT NULL,
    `content` JSON NOT NULL,
    `pdf` LONGBLOB NOT NULL,
    `sourceHash` CHAR(64) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `updatedBy` CHAR(36) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
