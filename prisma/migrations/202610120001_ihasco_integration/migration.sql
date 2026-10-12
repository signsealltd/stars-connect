-- CreateTable
CREATE TABLE `TrainingIntegration` (
    `id` CHAR(36) NOT NULL,
    `accountKey` VARCHAR(100) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `activatedAt` DATETIME(3) NULL,
    `approvedById` CHAR(36) NULL,
    `checkpoint` DATETIME(3) NULL,
    `lastFullSyncAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastCounts` JSON NULL,
    `connectionStatus` VARCHAR(30) NOT NULL DEFAULT 'UNTESTED',
    `lastError` VARCHAR(500) NULL,
    `successCodes` JSON NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `previewToken` CHAR(36) NULL,
    `preview` JSON NULL,
    `previewAt` DATETIME(3) NULL,
    `lockToken` CHAR(36) NULL,
    `lockExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrainingIntegration_accountKey_key`(`accountKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingIntegrationUser` (
    `integrationId` CHAR(36) NOT NULL,
    `externalId` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `staffId` CHAR(36) NULL,
    `matchState` VARCHAR(40) NOT NULL,

    UNIQUE INDEX `TrainingIntegrationUser_integrationId_staffId_key`(`integrationId`, `staffId`),
    PRIMARY KEY (`integrationId`, `externalId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingIntegrationCourse` (
    `integrationId` CHAR(36) NOT NULL,
    `externalId` VARCHAR(100) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `courseId` CHAR(36) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedById` CHAR(36) NULL,

    PRIMARY KEY (`integrationId`, `externalId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingExternalResult` (
    `id` CHAR(36) NOT NULL,
    `integrationId` CHAR(36) NOT NULL,
    `externalId` VARCHAR(100) NOT NULL,
    `externalUserId` VARCHAR(100) NOT NULL,
    `externalCourseId` VARCHAR(100) NOT NULL,
    `staffId` CHAR(36) NULL,
    `courseId` CHAR(36) NULL,
    `courseTitle` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `providerExpiryDate` DATE NULL,
    `starsExpiryDate` DATE NULL,
    `score` DOUBLE NULL,
    `passMark` DOUBLE NULL,
    `attempts` INTEGER NULL,
    `statusCode` INTEGER NOT NULL,
    `statusLabel` VARCHAR(191) NOT NULL,
    `qualifies` BOOLEAN NOT NULL DEFAULT false,
    `archivedAt` DATETIME(3) NULL,
    `providerUpdatedAt` DATETIME(3) NULL,
    `trainingRecordId` CHAR(36) NULL,
    `certificateDocumentId` CHAR(36) NULL,
    `certificateState` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `certificateError` VARCHAR(500) NULL,
    `certificateAttemptedAt` DATETIME(3) NULL,
    `contentHash` CHAR(64) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TrainingExternalResult_trainingRecordId_key`(`trainingRecordId`),
    INDEX `TrainingExternalResult_staffId_completedAt_idx`(`staffId`, `completedAt`),
    INDEX `TrainingExternalResult_integrationId_certificateState_idx`(`integrationId`, `certificateState`),
    UNIQUE INDEX `TrainingExternalResult_integrationId_externalId_key`(`integrationId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrainingIntegrationUser` ADD CONSTRAINT `TrainingIntegrationUser_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `TrainingIntegration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingIntegrationCourse` ADD CONSTRAINT `TrainingIntegrationCourse_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `TrainingIntegration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingExternalResult` ADD CONSTRAINT `TrainingExternalResult_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `TrainingIntegration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingExternalResult` ADD CONSTRAINT `TrainingExternalResult_trainingRecordId_fkey` FOREIGN KEY (`trainingRecordId`) REFERENCES `StaffTrainingRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
