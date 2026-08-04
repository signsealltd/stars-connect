ALTER TABLE `BillingRun`
  ADD COLUMN `label` VARCHAR(191) NULL,
  ADD COLUMN `selectedStudentIds` JSON NULL,
  ADD COLUMN `historicalMode` BOOLEAN NOT NULL DEFAULT false;