-- AlterTable
ALTER TABLE `Session` ADD COLUMN `scope` VARCHAR(20) NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE `FleetVehicle` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `registration` VARCHAR(30) NOT NULL,
    `registrationKey` VARCHAR(30) NOT NULL,
    `make` VARCHAR(80) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `vehicleType` VARCHAR(80) NOT NULL,
    `fuelType` VARCHAR(30) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `mileage` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NOT NULL,
    `notes` TEXT NULL,
    `motExpiry` DATE NULL,
    `taxExpiry` DATE NULL,
    `insuranceExpiry` DATE NULL,
    `serviceDue` DATE NULL,
    `serviceMileage` INTEGER NULL,
    `createdById` CHAR(36) NOT NULL,
    `updatedById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FleetVehicle_registrationKey_key`(`registrationKey`),
    INDEX `FleetVehicle_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleCheck` (
    `id` CHAR(36) NOT NULL,
    `vehicleId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `staffName` VARCHAR(191) NOT NULL,
    `checkDate` DATE NOT NULL,
    `clientStartedAt` DATETIME(3) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mileage` INTEGER NOT NULL,
    `outcome` VARCHAR(30) NOT NULL,
    `checklistVersion` VARCHAR(30) NOT NULL,
    `declarationVersion` VARCHAR(30) NOT NULL,
    `snapshot` JSON NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,

    INDEX `VehicleCheck_vehicleId_checkDate_idx`(`vehicleId`, `checkDate`),
    INDEX `VehicleCheck_userId_submittedAt_idx`(`userId`, `submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleDefect` (
    `id` CHAR(36) NOT NULL,
    `vehicleId` CHAR(36) NOT NULL,
    `checkId` CHAR(36) NOT NULL,
    `itemKey` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'REPORTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VehicleDefect_vehicleId_status_idx`(`vehicleId`, `status`),
    INDEX `VehicleDefect_severity_status_createdAt_idx`(`severity`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleDefectEvent` (
    `id` CHAR(36) NOT NULL,
    `defectId` CHAR(36) NOT NULL,
    `fromStatus` VARCHAR(30) NULL,
    `toStatus` VARCHAR(30) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `notes` TEXT NOT NULL,
    `details` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VehicleDefectEvent_defectId_createdAt_idx`(`defectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleMaintenance` (
    `id` CHAR(36) NOT NULL,
    `vehicleId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `performedAt` DATE NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `notes` TEXT NOT NULL,
    `cost` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VehicleMaintenance_vehicleId_performedAt_idx`(`vehicleId`, `performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VehicleCheck` ADD CONSTRAINT `VehicleCheck_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `FleetVehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDefect` ADD CONSTRAINT `VehicleDefect_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `FleetVehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDefect` ADD CONSTRAINT `VehicleDefect_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `VehicleCheck`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDefectEvent` ADD CONSTRAINT `VehicleDefectEvent_defectId_fkey` FOREIGN KEY (`defectId`) REFERENCES `VehicleDefect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleMaintenance` ADD CONSTRAINT `VehicleMaintenance_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `FleetVehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
