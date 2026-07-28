ALTER TABLE `Device`
  ADD COLUMN `batteryLevel` INTEGER NULL,
  ADD COLUMN `batteryCharging` BOOLEAN NULL,
  ADD COLUMN `batteryUpdatedAt` DATETIME(3) NULL;
