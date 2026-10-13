-- AlterTable
ALTER TABLE `PremisesAsset` ADD COLUMN `assetSequence` INTEGER NOT NULL AUTO_INCREMENT,
    ADD UNIQUE INDEX `PremisesAsset_assetSequence_key` (`assetSequence`),
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `labelPrintedAt` DATETIME(3) NULL,
    ADD COLUMN `labelQueued` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `photoDocumentId` CHAR(36) NULL,
    ADD COLUMN `publicEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publicLocation` VARCHAR(191) NULL,
    ADD COLUMN `publicPhotoFileId` CHAR(36) NULL,
    ADD COLUMN `systemName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PremisesInspection` ADD COLUMN `publicSummary` VARCHAR(1000) NULL,
    ADD COLUMN `scheduleId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `PremisesDocument` ADD COLUMN `publishedFileId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `AssetTestSchedule` (
    `id` CHAR(36) NOT NULL,
    `assetId` CHAR(36) NOT NULL,
    `testType` VARCHAR(191) NOT NULL,
    `recurrenceDays` INTEGER NULL,
    `nextDueDate` DATE NULL,
    `responsibleName` VARCHAR(191) NULL,
    `checklist` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssetTestSchedule_assetId_active_nextDueDate_idx`(`assetId`, `active`, `nextDueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetCategory` (
    `key` VARCHAR(60) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `suggestedTests` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetLabelProfile` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `configuration` JSON NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;



-- AddForeignKey
ALTER TABLE `PremisesInspection` ADD CONSTRAINT `PremisesInspection_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `AssetTestSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetTestSchedule` ADD CONSTRAINT `AssetTestSchedule_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `PremisesAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve legacy due dates as explicit schedules; no invented test history.
INSERT INTO AssetTestSchedule (id,assetId,testType,recurrenceDays,nextDueDate,active,updatedAt) SELECT UUID(),id,'Existing inspection schedule',recurrenceDays,nextDueDate,true,NOW(3) FROM PremisesAsset WHERE recurrenceDays IS NOT NULL OR nextDueDate IS NOT NULL;
INSERT INTO AssetCategory (`key`,name,suggestedTests) VALUES ('EMERGENCY_LIGHTING','Emergency lighting','Function test; duration test'),
('GENERAL_LIGHTING','General lighting','Condition inspection'),
('FIRE_ALARM','Fire alarms','Function test'),
('FIRE_EXTINGUISHERS','Fire safety equipment','Condition inspection; service'),
('COMPUTERS_IT','Computers and IT','Condition inspection'),
('SECURITY','Access control / RFID readers','Function test'),
('KITCHEN','Kitchen appliances','Condition inspection; service'),
('FURNITURE','Furniture and general equipment','Condition inspection'),
('ELECTRICAL','Electrical','Electrical inspection'),
('GAS_HEATING','Gas and heating','Service'),
('WATER_HYGIENE','Water hygiene','Water inspection'),
('LIFT_ACCESS','Lifts and access','Service'),
('BUILDING_FABRIC','Building fabric','Condition inspection'),
('OTHER','Other','');

-- Archived assets keep their records and identifiers and display as retired.
UPDATE PremisesAsset SET status='DECOMMISSIONED' WHERE active=false;
