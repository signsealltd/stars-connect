-- AlterTable
ALTER TABLE `ChargeRule` ADD COLUMN `fundedDayCount` DECIMAL(6, 2) NULL;

-- AlterTable
ALTER TABLE `BillingRun` ADD COLUMN `bankHolidayDates` JSON NULL,
    ADD COLUMN `billingPeriodId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `BillingCharge` ADD COLUMN `bankHolidayDays` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `fundedDays` DECIMAL(6, 2) NULL,
    ADD COLUMN `removedDays` DECIMAL(6, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `BillingPeriod` (
    `id` CHAR(36) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `cycle` VARCHAR(20) NOT NULL,
    `invoiceMonth` VARCHAR(7) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `bankHolidayDates` JSON NOT NULL,
    `updatedById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingPeriod_periodStart_periodEnd_idx`(`periodStart`, `periodEnd`),
    UNIQUE INDEX `BillingPeriod_cycle_invoiceMonth_key`(`cycle`, `invoiceMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
