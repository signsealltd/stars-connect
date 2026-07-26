-- Extend roles and existing business records without changing historical values
ALTER TABLE `User` MODIFY `role` ENUM('ADMINISTRATOR', 'DIRECTOR', 'MANAGER', 'RECEPTION') NOT NULL;
ALTER TABLE `StaffMember` ADD COLUMN `payrollNumber` VARCHAR(80) NULL;
CREATE UNIQUE INDEX `StaffMember_payrollNumber_key` ON `StaffMember`(`payrollNumber`);
ALTER TABLE `Student` ADD COLUMN `billingReference` VARCHAR(100) NULL;
ALTER TABLE `Visitor` ADD COLUMN `email` VARCHAR(191) NULL;
-- CreateTable
CREATE TABLE `DocumentRecord` (
    `id` CHAR(36) NOT NULL,
    `documentNumber` VARCHAR(80) NOT NULL,
    `documentType` VARCHAR(40) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
    `createdById` CHAR(36) NOT NULL,
    `reviewedById` CHAR(36) NULL,
    `approvedById` CHAR(36) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `generatedAt` DATETIME(3) NULL,
    `generationSource` VARCHAR(40) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `sha256Hash` CHAR(64) NOT NULL,
    `revisionReason` TEXT NULL,
    `supersededDocumentId` CHAR(36) NULL,
    `emailDeliveryStatus` VARCHAR(30) NULL,
    `sourceType` VARCHAR(40) NULL,
    `sourceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentRecord_documentType_periodStart_periodEnd_idx`(`documentType`, `periodStart`, `periodEnd`),
    INDEX `DocumentRecord_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    UNIQUE INDEX `DocumentRecord_documentNumber_version_key`(`documentNumber`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollPeriod` (
    `id` CHAR(36) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `payDate` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `revisionReason` TEXT NULL,
    `supersedesPeriodId` CHAR(36) NULL,
    `createdById` CHAR(36) NOT NULL,
    `reviewedById` CHAR(36) NULL,
    `approvedById` CHAR(36) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayrollPeriod_status_periodStart_idx`(`status`, `periodStart`),
    UNIQUE INDEX `PayrollPeriod_periodStart_periodEnd_version_key`(`periodStart`, `periodEnd`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollEntry` (
    `id` CHAR(36) NOT NULL,
    `payrollPeriodId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `staffName` VARCHAR(120) NOT NULL,
    `payrollNumber` VARCHAR(80) NULL,
    `ordinaryMinutes` INTEGER NOT NULL DEFAULT 0,
    `overtimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `holidayMinutes` INTEGER NOT NULL DEFAULT 0,
    `sicknessMinutes` INTEGER NOT NULL DEFAULT 0,
    `trainingMinutes` INTEGER NOT NULL DEFAULT 0,
    `unpaidMinutes` INTEGER NOT NULL DEFAULT 0,
    `adjustmentMinutes` INTEGER NOT NULL DEFAULT 0,
    `totalPayableMinutes` INTEGER NOT NULL DEFAULT 0,
    `exceptionCount` INTEGER NOT NULL DEFAULT 0,
    `exceptionStatus` VARCHAR(30) NOT NULL DEFAULT 'CLEAR',
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` CHAR(36) NULL,
    `sourceSnapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayrollEntry_staffId_idx`(`staffId`),
    UNIQUE INDEX `PayrollEntry_payrollPeriodId_staffId_key`(`payrollPeriodId`, `staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollAdjustment` (
    `id` CHAR(36) NOT NULL,
    `payrollPeriodId` CHAR(36) NOT NULL,
    `staffId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `category` VARCHAR(30) NOT NULL,
    `minutes` INTEGER NOT NULL,
    `paid` BOOLEAN NOT NULL DEFAULT true,
    `reason` TEXT NOT NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PayrollAdjustment_payrollPeriodId_staffId_date_idx`(`payrollPeriodId`, `staffId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingProfile` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `payerType` VARCHAR(40) NOT NULL,
    `payerName` VARCHAR(191) NOT NULL,
    `billingAddress` TEXT NOT NULL,
    `billingEmail` VARCHAR(191) NULL,
    `contactTelephone` VARCHAR(40) NULL,
    `fundingOrganisation` VARCHAR(191) NULL,
    `purchaseOrderNumber` VARCHAR(100) NULL,
    `fundingReference` VARCHAR(100) NULL,
    `billingReference` VARCHAR(100) NULL,
    `invoiceFrequency` VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 30,
    `currency` CHAR(3) NOT NULL DEFAULT 'GBP',
    `vatTreatment` VARCHAR(30) NOT NULL DEFAULT 'OUTSIDE_SCOPE',
    `vatRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `exemptionReason` TEXT NULL,
    `consolidatedByPayer` BOOLEAN NOT NULL DEFAULT false,
    `activeFrom` DATE NOT NULL,
    `activeTo` DATE NULL,
    `financeNotes` TEXT NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingProfile_studentId_activeFrom_activeTo_idx`(`studentId`, `activeFrom`, `activeTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChargeRule` (
    `id` CHAR(36) NOT NULL,
    `billingProfileId` CHAR(36) NOT NULL,
    `chargeType` VARCHAR(40) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `unitType` VARCHAR(30) NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `attendanceDependency` VARCHAR(30) NOT NULL DEFAULT 'ATTENDED',
    `applicableWeekdays` JSON NOT NULL,
    `activeFrom` DATE NOT NULL,
    `activeTo` DATE NULL,
    `minimumMinutes` INTEGER NULL,
    `roundingMinutes` INTEGER NULL,
    `vatTreatment` VARCHAR(30) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChargeRule_billingProfileId_active_idx`(`billingProfileId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingRun` (
    `id` CHAR(36) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `revisionReason` TEXT NULL,
    `supersedesRunId` CHAR(36) NULL,
    `createdById` CHAR(36) NOT NULL,
    `reviewedById` CHAR(36) NULL,
    `approvedById` CHAR(36) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingRun_status_periodStart_idx`(`status`, `periodStart`),
    UNIQUE INDEX `BillingRun_periodStart_periodEnd_version_key`(`periodStart`, `periodEnd`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingCharge` (
    `id` CHAR(36) NOT NULL,
    `billingRunId` CHAR(36) NOT NULL,
    `billingProfileId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `studentName` VARCHAR(120) NOT NULL,
    `payerName` VARCHAR(191) NOT NULL,
    `sourceAttendanceId` CHAR(36) NULL,
    `sourceDate` DATE NOT NULL,
    `chargeRuleId` CHAR(36) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unitRate` DECIMAL(10, 2) NOT NULL,
    `netAmount` DECIMAL(10, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL,
    `vatAmount` DECIMAL(10, 2) NOT NULL,
    `grossAmount` DECIMAL(10, 2) NOT NULL,
    `manuallyAdjusted` BOOLEAN NOT NULL DEFAULT false,
    `adjustmentReason` TEXT NULL,
    `excluded` BOOLEAN NOT NULL DEFAULT false,
    `exceptionCode` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingCharge_billingRunId_studentId_idx`(`billingRunId`, `studentId`),
    UNIQUE INDEX `BillingCharge_billingRunId_sourceAttendanceId_chargeRuleId_key`(`billingRunId`, `sourceAttendanceId`, `chargeRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` CHAR(36) NOT NULL,
    `billingRunId` CHAR(36) NOT NULL,
    `invoiceNumber` VARCHAR(80) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `studentId` CHAR(36) NULL,
    `payerName` VARCHAR(191) NOT NULL,
    `billingProfileId` CHAR(36) NOT NULL,
    `invoiceDate` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `netTotal` DECIMAL(10, 2) NOT NULL,
    `vatTotal` DECIMAL(10, 2) NOT NULL,
    `grossTotal` DECIMAL(10, 2) NOT NULL,
    `documentId` CHAR(36) NULL,
    `issuedAt` DATETIME(3) NULL,
    `supersedesId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Invoice_billingRunId_payerName_idx`(`billingRunId`, `payerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyAttendanceReport` (
    `id` CHAR(36) NOT NULL,
    `reportDate` DATE NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(30) NOT NULL DEFAULT 'GENERATING',
    `generatedById` CHAR(36) NULL,
    `generationSource` VARCHAR(40) NOT NULL,
    `generatedAt` DATETIME(3) NULL,
    `studentCount` INTEGER NOT NULL DEFAULT 0,
    `staffCount` INTEGER NOT NULL DEFAULT 0,
    `visitorCount` INTEGER NOT NULL DEFAULT 0,
    `exceptionCount` INTEGER NOT NULL DEFAULT 0,
    `sourceSnapshot` JSON NOT NULL,
    `pdfDocumentId` CHAR(36) NULL,
    `csvDocumentId` CHAR(36) NULL,
    `potentiallyOutdated` BOOLEAN NOT NULL DEFAULT false,
    `revisionReason` TEXT NULL,
    `supersedesReportId` CHAR(36) NULL,
    `recipientSummary` VARCHAR(500) NULL,
    `emailDeliveryStatus` VARCHAR(30) NULL,
    `executionKey` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyAttendanceReport_executionKey_key`(`executionKey`),
    INDEX `DailyAttendanceReport_reportDate_status_idx`(`reportDate`, `status`),
    UNIQUE INDEX `DailyAttendanceReport_reportDate_version_key`(`reportDate`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportDelivery` (
    `id` CHAR(36) NOT NULL,
    `reportId` CHAR(36) NOT NULL,
    `recipients` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `attemptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `idempotencyKey` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `ReportDelivery_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ReportDelivery_reportId_status_idx`(`reportId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PayrollEntry` ADD CONSTRAINT `PayrollEntry_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `PayrollPeriod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollAdjustment` ADD CONSTRAINT `PayrollAdjustment_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `PayrollPeriod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChargeRule` ADD CONSTRAINT `ChargeRule_billingProfileId_fkey` FOREIGN KEY (`billingProfileId`) REFERENCES `BillingProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingCharge` ADD CONSTRAINT `BillingCharge_billingRunId_fkey` FOREIGN KEY (`billingRunId`) REFERENCES `BillingRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_billingRunId_fkey` FOREIGN KEY (`billingRunId`) REFERENCES `BillingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportDelivery` ADD CONSTRAINT `ReportDelivery_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `DailyAttendanceReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

