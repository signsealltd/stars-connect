ALTER TABLE `Invoice` ADD COLUMN `paymentState` VARCHAR(20) NOT NULL DEFAULT 'AUTO', ADD COLUMN `paymentRevision` INTEGER NOT NULL DEFAULT 0;
CREATE TABLE `PaymentEvent` (
 `id` CHAR(36) NOT NULL, `invoiceId` CHAR(36) NOT NULL,
 `action` VARCHAR(30) NOT NULL, `previousState` VARCHAR(20) NOT NULL, `newState` VARCHAR(20) NOT NULL,
 `actorId` CHAR(36) NOT NULL, `actorName` VARCHAR(191) NOT NULL,
 `amount` DECIMAL(10,2) NULL, `receivedDate` DATE NULL, `reference` VARCHAR(191) NULL,
 `reason` VARCHAR(191) NULL, `notes` VARCHAR(1000) NULL, `revision` INTEGER NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`), UNIQUE INDEX `PaymentEvent_invoiceId_revision_key` (`invoiceId`,`revision`), INDEX `PaymentEvent_invoiceId_createdAt_idx` (`invoiceId`,`createdAt`),
 CONSTRAINT `PaymentEvent_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
