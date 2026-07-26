-- AlterTable
ALTER TABLE `ReportDelivery` ADD COLUMN `emailType` VARCHAR(40) NOT NULL DEFAULT 'DAILY_REPORT',
    ADD COLUMN `initiatedById` CHAR(36) NULL,
    ADD COLUMN `invocationSource` VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    ADD COLUMN `safeCategory` VARCHAR(40) NULL,
    ADD COLUMN `smtpResponseCode` VARCHAR(20) NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MailOperation` (
    `id` CHAR(36) NOT NULL,
    `operationType` VARCHAR(40) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `recipient` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `safeCategory` VARCHAR(40) NOT NULL,
    `smtpResponseCode` VARCHAR(20) NULL,
    `safeSummary` VARCHAR(500) NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `actorId` CHAR(36) NULL,
    `environmentName` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MailOperation_operationType_createdAt_idx`(`operationType`, `createdAt`),
    INDEX `MailOperation_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledJobRun` (
    `id` CHAR(36) NOT NULL,
    `executionKey` VARCHAR(120) NOT NULL,
    `jobType` VARCHAR(50) NOT NULL,
    `reportDate` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `reportId` CHAR(36) NULL,
    `safeSummary` VARCHAR(500) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `lockExpiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScheduledJobRun_executionKey_key`(`executionKey`),
    INDEX `ScheduledJobRun_jobType_reportDate_idx`(`jobType`, `reportDate`),
    INDEX `ScheduledJobRun_status_startedAt_idx`(`status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

