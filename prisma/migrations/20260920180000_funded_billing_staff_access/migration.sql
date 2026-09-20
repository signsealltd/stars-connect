-- AlterTable
ALTER TABLE `User` ADD COLUMN `accessLevelId` CHAR(36) NULL,
    MODIFY `role` ENUM('TEAM_LEADER', 'CARE_ASSISTANT', 'ADMINISTRATOR', 'DIRECTOR', 'MANAGER', 'RECEPTION') NOT NULL;

-- AlterTable
ALTER TABLE `StaffMember` ADD COLUMN `accessLevelId` CHAR(36) NULL,
    ADD COLUMN `userId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `Student` ADD COLUMN `careInformation` JSON NULL;

-- AlterTable
ALTER TABLE `BillingRun` ADD COLUMN `requestKey` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `purchaseOrderNumber` VARCHAR(100) NULL,
    ADD COLUMN `studentName` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `SafeguardingEnquiry` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `episodeKey` VARCHAR(100) NOT NULL,
    `absenceIds` JSON NOT NULL,
    `absenceDates` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `closedById` CHAR(36) NULL,
    `closedByName` VARCHAR(120) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SafeguardingEnquiry_episodeKey_key`(`episodeKey`),
    INDEX `SafeguardingEnquiry_studentId_status_idx`(`studentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationalTask` (
    `id` CHAR(36) NOT NULL,
    `sourceKey` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    `owner` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `billingRunId` CHAR(36) NULL,
    `createdById` CHAR(36) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OperationalTask_sourceKey_key`(`sourceKey`),
    INDEX `OperationalTask_startDate_status_idx`(`startDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffResource` (
    `id` CHAR(36) NOT NULL,
    `seriesId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `category` VARCHAR(30) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `studentId` CHAR(36) NULL,
    `documentId` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `reviewDate` DATE NULL,
    `createdById` CHAR(36) NOT NULL,
    `publishedById` CHAR(36) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StaffResource_category_status_idx`(`category`, `status`),
    INDEX `StaffResource_studentId_idx`(`studentId`),
    UNIQUE INDEX `StaffResource_seriesId_version_key`(`seriesId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffResourceReceipt` (
    `id` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `viewedAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `agreedAt` DATETIME(3) NULL,

    UNIQUE INDEX `StaffResourceReceipt_resourceId_userId_key`(`resourceId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessLevel` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `baseRole` ENUM('TEAM_LEADER', 'CARE_ASSISTANT', 'ADMINISTRATOR', 'DIRECTOR', 'MANAGER', 'RECEPTION') NOT NULL DEFAULT 'CARE_ASSISTANT',
    `permissions` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedById` CHAR(36) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessLevel_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `StaffMember_userId_key` ON `StaffMember`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `BillingRun_requestKey_key` ON `BillingRun`(`requestKey`);
