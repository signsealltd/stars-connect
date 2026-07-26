ALTER TABLE `Device` ADD COLUMN `isSeedData` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `DeviceProvisioningCode` (
  `id` CHAR(36) NOT NULL,
  `deviceId` CHAR(36) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdById` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DeviceProvisioningCode_codeHash_key` (`codeHash`),
  INDEX `DeviceProvisioningCode_deviceId_expiresAt_idx` (`deviceId`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DeviceProvisioningCode_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Known fake devices from the development seed must never be treated as real authorised tablets.
UPDATE `Device`
SET `isSeedData` = true, `status` = 'REVOKED', `revokedAt` = COALESCE(`revokedAt`, NOW(3)), `pendingEventCount` = 0
WHERE `tokenHash` IN (
  'a859b85ad3fcb41f9178b9cc408ee0a2064289943146c734080f898b1d9c338c',
  'c8ae3da2f537fe0db8d6794a7c07776773f3978d287a1c5a274d5ca90b17ee63'
);