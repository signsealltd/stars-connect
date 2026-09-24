-- AlterTable
ALTER TABLE `OperationalTask` ADD COLUMN `assignedStaffId` CHAR(36) NULL,
    ADD COLUMN `details` JSON NULL,
    ADD COLUMN `priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE `ClientMedication` (
    `stockAt` DATETIME(3) NULL,
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `sourceKey` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `strength` VARCHAR(100) NULL,
    `form` VARCHAR(60) NULL,
    `unit` VARCHAR(40) NOT NULL DEFAULT 'units',
    `quantity` DECIMAL(14, 4) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `dose` DECIMAL(14, 4) NULL,
    `administrations` DECIMAL(8, 4) NULL,
    `weekdayUsage` JSON NULL,
    `prn` BOOLEAN NOT NULL DEFAULT false,
    `manualDailyUsage` DECIMAL(14, 4) NULL,
    `reminderDays` INTEGER NOT NULL DEFAULT 14,
    `confirmationDays` INTEGER NOT NULL DEFAULT 30,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `responsibleStaffId` CHAR(36) NULL,
    `notes` TEXT NULL,
    `prescription` JSON NULL,
    `cycle` INTEGER NOT NULL DEFAULT 0,
    `activeTaskId` CHAR(36) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientMedication_sourceKey_key`(`sourceKey`),
    UNIQUE INDEX `ClientMedication_activeTaskId_key`(`activeTaskId`),
    INDEX `ClientMedication_studentId_status_idx`(`studentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicationStockEvent` (
    `id` CHAR(36) NOT NULL,
    `medicationId` CHAR(36) NOT NULL,
    `requestKey` CHAR(36) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `previousQuantity` DECIMAL(14, 4) NULL,
    `newQuantity` DECIMAL(14, 4) NULL,
    `changeAmount` DECIMAL(14, 4) NULL,
    `reason` TEXT NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `details` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MedicationStockEvent_requestKey_key`(`requestKey`),
    INDEX `MedicationStockEvent_medicationId_createdAt_idx`(`medicationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationalTaskEvent` (
    `id` CHAR(36) NOT NULL,
    `taskId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `details` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OperationalTaskEvent_taskId_createdAt_idx`(`taskId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffHrRecord` (
    `staffId` CHAR(36) NOT NULL,
    `personal` JSON NOT NULL,
    `employment` JSON NOT NULL,
    `medical` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffHrEvent` (
    `id` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `beforeValue` JSON NOT NULL,
    `afterValue` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StaffHrEvent_staffId_createdAt_idx`(`staffId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientMedication` ADD CONSTRAINT `ClientMedication_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicationStockEvent` ADD CONSTRAINT `MedicationStockEvent_medicationId_fkey` FOREIGN KEY (`medicationId`) REFERENCES `ClientMedication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationalTaskEvent` ADD CONSTRAINT `OperationalTaskEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `OperationalTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffHrRecord` ADD CONSTRAINT `StaffHrRecord_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
