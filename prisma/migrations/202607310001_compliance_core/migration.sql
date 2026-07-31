-- AlterTable
ALTER TABLE `User` ADD COLUMN `organisationId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `Organisation` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organisation_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceCategory` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `recordType` ENUM('RISK_ASSESSMENT', 'RAMS', 'COSHH', 'POLICY') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComplianceCategory_organisationId_recordType_active_idx`(`organisationId`, `recordType`, `active`),
    UNIQUE INDEX `ComplianceCategory_organisationId_recordType_name_key`(`organisationId`, `recordType`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiskMatrixConfiguration` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `size` INTEGER NOT NULL DEFAULT 5,
    `likelihood` JSON NOT NULL,
    `severity` JSON NOT NULL,
    `thresholds` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RiskMatrixConfiguration_organisationId_active_idx`(`organisationId`, `active`),
    UNIQUE INDEX `RiskMatrixConfiguration_organisationId_name_key`(`organisationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceRecord` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `recordType` ENUM('RISK_ASSESSMENT', 'RAMS', 'COSHH', 'POLICY') NOT NULL,
    `reference` VARCHAR(80) NOT NULL,
    `publishedVersionNumber` INTEGER NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComplianceRecord_organisationId_recordType_archivedAt_idx`(`organisationId`, `recordType`, `archivedAt`),
    INDEX `ComplianceRecord_organisationId_publishedVersionNumber_idx`(`organisationId`, `publishedVersionNumber`),
    UNIQUE INDEX `ComplianceRecord_organisationId_reference_key`(`organisationId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceRecordVersion` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `recordId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(191) NOT NULL,
    `categoryId` CHAR(36) NULL,
    `description` TEXT NULL,
    `scope` TEXT NULL,
    `premisesLocation` VARCHAR(191) NULL,
    `relatedActivity` VARCHAR(191) NULL,
    `relatedAssetId` CHAR(36) NULL,
    `assessorId` CHAR(36) NULL,
    `responsibleManagerId` CHAR(36) NULL,
    `assessmentDate` DATE NULL,
    `reviewDate` DATE NULL,
    `overallResidualRisk` INTEGER NULL,
    `structuredContent` JSON NULL,
    `internalNotes` TEXT NULL,
    `revisionNotes` TEXT NULL,
    `tags` JSON NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` CHAR(36) NULL,
    `publishedAt` DATETIME(3) NULL,
    `publishedById` CHAR(36) NULL,
    `supersedesVersionId` CHAR(36) NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComplianceRecordVersion_organisationId_status_reviewDate_idx`(`organisationId`, `status`, `reviewDate`),
    INDEX `ComplianceRecordVersion_organisationId_categoryId_status_idx`(`organisationId`, `categoryId`, `status`),
    INDEX `ComplianceRecordVersion_relatedAssetId_idx`(`relatedAssetId`),
    UNIQUE INDEX `ComplianceRecordVersion_recordId_version_key`(`recordId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiskAssessmentHazard` (
    `id` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `hazard` TEXT NOT NULL,
    `whoMayBeHarmed` TEXT NOT NULL,
    `howTheyMayBeHarmed` TEXT NOT NULL,
    `existingControls` TEXT NOT NULL,
    `initialLikelihood` INTEGER NOT NULL,
    `initialSeverity` INTEGER NOT NULL,
    `initialRiskScore` INTEGER NOT NULL,
    `furtherControls` TEXT NULL,
    `actionOwnerId` CHAR(36) NULL,
    `targetDate` DATE NULL,
    `residualLikelihood` INTEGER NOT NULL,
    `residualSeverity` INTEGER NOT NULL,
    `residualRiskScore` INTEGER NOT NULL,
    `actionStatus` ENUM('OPEN', 'IN_PROGRESS', 'AWAITING_EVIDENCE', 'AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RiskAssessmentHazard_versionId_sortOrder_idx`(`versionId`, `sortOrder`),
    INDEX `RiskAssessmentHazard_actionOwnerId_targetDate_idx`(`actionOwnerId`, `targetDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RamsMethodStep` (
    `id` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `stepNumber` INTEGER NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `method` TEXT NOT NULL,
    `responsibleRole` VARCHAR(120) NULL,
    `equipmentRequired` TEXT NULL,
    `protectiveMeasures` TEXT NULL,
    `safetyChecks` TEXT NULL,
    `stopWorkConditions` TEXT NULL,
    `emergencyResponse` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RamsMethodStep_versionId_stepNumber_key`(`versionId`, `stepNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RamsChecklistItem` (
    `id` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `label` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedById` CHAR(36) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `RamsChecklistItem_versionId_sortOrder_idx`(`versionId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceApproval` (
    `id` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `comments` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComplianceApproval_versionId_createdAt_idx`(`versionId`, `createdAt`),
    INDEX `ComplianceApproval_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceAssignment` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `staffRole` VARCHAR(100) NULL,
    `location` VARCHAR(191) NULL,
    `allStaff` BOOLEAN NOT NULL DEFAULT false,
    `assignedById` CHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComplianceAssignment_organisationId_versionId_idx`(`organisationId`, `versionId`),
    INDEX `ComplianceAssignment_organisationId_userId_idx`(`organisationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceAcknowledgement` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `statementVersion` VARCHAR(20) NOT NULL DEFAULT 'v1',
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `sessionReference` VARCHAR(120) NULL,
    `deviceId` CHAR(36) NULL,
    `acknowledgedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComplianceAcknowledgement_organisationId_userId_acknowledged_idx`(`organisationId`, `userId`, `acknowledgedAt`),
    UNIQUE INDEX `ComplianceAcknowledgement_organisationId_versionId_userId_key`(`organisationId`, `versionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceAttachment` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NULL,
    `actionId` CHAR(36) NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `sha256Hash` CHAR(64) NOT NULL,
    `uploadedById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComplianceAttachment_organisationId_versionId_idx`(`organisationId`, `versionId`),
    INDEX `ComplianceAttachment_organisationId_actionId_idx`(`organisationId`, `actionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceAction` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `reference` VARCHAR(80) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sourceType` VARCHAR(60) NULL,
    `sourceId` CHAR(36) NULL,
    `premisesLocation` VARCHAR(191) NULL,
    `assignedUserId` CHAR(36) NULL,
    `priority` VARCHAR(20) NOT NULL,
    `dueDate` DATE NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'AWAITING_EVIDENCE', 'AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `completionNotes` TEXT NULL,
    `verificationRequired` BOOLEAN NOT NULL DEFAULT false,
    `completedById` CHAR(36) NULL,
    `completedAt` DATETIME(3) NULL,
    `verifiedById` CHAR(36) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComplianceAction_organisationId_status_dueDate_idx`(`organisationId`, `status`, `dueDate`),
    INDEX `ComplianceAction_organisationId_assignedUserId_status_idx`(`organisationId`, `assignedUserId`, `status`),
    INDEX `ComplianceAction_organisationId_sourceType_sourceId_idx`(`organisationId`, `sourceType`, `sourceId`),
    UNIQUE INDEX `ComplianceAction_organisationId_reference_key`(`organisationId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceTemplate` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `recordType` ENUM('RISK_ASSESSMENT', 'RAMS', 'COSHH', 'POLICY') NOT NULL,
    `categoryId` CHAR(36) NULL,
    `name` VARCHAR(191) NOT NULL,
    `defaultContent` JSON NOT NULL,
    `defaultReviewDays` INTEGER NULL,
    `requiredFields` JSON NULL,
    `optionalFields` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `requiresApprovalNotice` BOOLEAN NOT NULL DEFAULT true,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComplianceTemplate_organisationId_recordType_active_idx`(`organisationId`, `recordType`, `active`),
    UNIQUE INDEX `ComplianceTemplate_organisationId_recordType_name_key`(`organisationId`, `recordType`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceNotificationEvent` (
    `id` CHAR(36) NOT NULL,
    `organisationId` CHAR(36) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(60) NOT NULL,
    `recordType` VARCHAR(60) NOT NULL,
    `recordId` CHAR(36) NOT NULL,
    `versionId` CHAR(36) NULL,
    `recipientId` CHAR(36) NULL,
    `dueDate` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,

    UNIQUE INDEX `ComplianceNotificationEvent_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ComplianceNotificationEvent_organisationId_status_createdAt_idx`(`organisationId`, `status`, `createdAt`),
    INDEX `ComplianceNotificationEvent_organisationId_recordType_record_idx`(`organisationId`, `recordType`, `recordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_organisationId_active_idx` ON `User`(`organisationId`, `active`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceCategory` ADD CONSTRAINT `ComplianceCategory_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiskMatrixConfiguration` ADD CONSTRAINT `RiskMatrixConfiguration_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRecord` ADD CONSTRAINT `ComplianceRecord_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRecordVersion` ADD CONSTRAINT `ComplianceRecordVersion_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `ComplianceRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRecordVersion` ADD CONSTRAINT `ComplianceRecordVersion_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ComplianceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRecordVersion` ADD CONSTRAINT `ComplianceRecordVersion_supersedesVersionId_fkey` FOREIGN KEY (`supersedesVersionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiskAssessmentHazard` ADD CONSTRAINT `RiskAssessmentHazard_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RamsMethodStep` ADD CONSTRAINT `RamsMethodStep_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RamsChecklistItem` ADD CONSTRAINT `RamsChecklistItem_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceApproval` ADD CONSTRAINT `ComplianceApproval_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAssignment` ADD CONSTRAINT `ComplianceAssignment_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAcknowledgement` ADD CONSTRAINT `ComplianceAcknowledgement_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAcknowledgement` ADD CONSTRAINT `ComplianceAcknowledgement_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAttachment` ADD CONSTRAINT `ComplianceAttachment_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ComplianceRecordVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAttachment` ADD CONSTRAINT `ComplianceAttachment_actionId_fkey` FOREIGN KEY (`actionId`) REFERENCES `ComplianceAction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAttachment` ADD CONSTRAINT `ComplianceAttachment_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceAction` ADD CONSTRAINT `ComplianceAction_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceTemplate` ADD CONSTRAINT `ComplianceTemplate_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceTemplate` ADD CONSTRAINT `ComplianceTemplate_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ComplianceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceNotificationEvent` ADD CONSTRAINT `ComplianceNotificationEvent_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- Deterministic organisation boundary for the existing single-site installation.
INSERT INTO Organisation (id, name, slug, active, createdAt, updatedAt) VALUES ('00000000-0000-4000-8000-000000000001','STARS Day Service','stars-day-service',true,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
UPDATE User SET organisationId='00000000-0000-4000-8000-000000000001' WHERE organisationId IS NULL;
INSERT INTO RiskMatrixConfiguration (id,organisationId,name,size,likelihood,severity,thresholds,active,createdAt,updatedAt) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Default 5 x 5 matrix',5,JSON_ARRAY('Rare','Unlikely','Possible','Likely','Almost certain'),JSON_ARRAY('Insignificant','Minor','Moderate','Major','Severe'),JSON_OBJECT('lowMax',4,'mediumMax',9,'highMax',16,'criticalMin',17),true,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
INSERT INTO ComplianceCategory (id,organisationId,recordType,name,description,active,sortOrder,createdAt,updatedAt) VALUES
(UUID(),'00000000-0000-4000-8000-000000000001','RISK_ASSESSMENT','General premises',NULL,true,10,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','RISK_ASSESSMENT','Activity-specific',NULL,true,20,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','RISK_ASSESSMENT','Service-user-specific','Sensitive access controls apply.',true,30,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','RAMS','Activity RAMS',NULL,true,10,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','RAMS','Community outing RAMS',NULL,true,20,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','RAMS','Vehicle journey RAMS',NULL,true,30,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','COSHH','Cleaning substance',NULL,true,10,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','POLICY','Health and safety policy',NULL,true,10,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'00000000-0000-4000-8000-000000000001','POLICY','Emergency procedure',NULL,true,20,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
