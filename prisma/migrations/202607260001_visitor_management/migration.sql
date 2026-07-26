-- Add visitor sync operations
ALTER TABLE `SyncEvent` MODIFY `operation` ENUM('CLOCK_EVENT','ATTENDANCE','ROLL_CALL_ENTRY','VISITOR_SIGN_IN','VISITOR_SIGN_OUT') NOT NULL;

CREATE TABLE `Visitor` (
  `id` CHAR(36) NOT NULL,
  `fullName` VARCHAR(120) NOT NULL,
  `normalizedName` VARCHAR(120) NOT NULL,
  `company` VARCHAR(191) NULL,
  `mobile` VARCHAR(40) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `anonymizedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `Visitor_normalizedName_idx` (`normalizedName`),
  INDEX `Visitor_company_idx` (`company`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitorReason` (
  `id` CHAR(36) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `VisitorReason_label_key` (`label`),
  INDEX `VisitorReason_active_sortOrder_idx` (`active`,`sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitorRuleSet` (
  `id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `rulesText` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisitorRuleSet_version_key` (`version`),
  INDEX `VisitorRuleSet_active_version_idx` (`active`,`version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitorVisit` (
  `id` CHAR(36) NOT NULL,
  `visitorId` CHAR(36) NOT NULL,
  `referenceCode` VARCHAR(12) NOT NULL,
  `host` VARCHAR(120) NOT NULL,
  `reasonId` CHAR(36) NULL,
  `reasonLabel` VARCHAR(100) NOT NULL,
  `otherReason` VARCHAR(250) NULL,
  `vehicleRegistration` VARCHAR(20) NULL,
  `expectedDurationMinutes` INTEGER NULL,
  `signedInAt` DATETIME(3) NOT NULL,
  `signedOutAt` DATETIME(3) NULL,
  `signInDeviceId` CHAR(36) NOT NULL,
  `signOutDeviceId` CHAR(36) NULL,
  `signedOutByUserId` CHAR(36) NULL,
  `signOutCorrectionReason` TEXT NULL,
  `emergencyIncluded` BOOLEAN NOT NULL DEFAULT true,
  `archivedAt` DATETIME(3) NULL,
  `anonymizedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `VisitorVisit_referenceCode_key` (`referenceCode`),
  INDEX `VisitorVisit_signedInAt_idx` (`signedInAt`),
  INDEX `VisitorVisit_signedOutAt_idx` (`signedOutAt`),
  INDEX `VisitorVisit_host_idx` (`host`),
  INDEX `VisitorVisit_reasonId_idx` (`reasonId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisitorVisit_visitorId_fkey` FOREIGN KEY (`visitorId`) REFERENCES `Visitor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VisitorVisit_reasonId_fkey` FOREIGN KEY (`reasonId`) REFERENCES `VisitorReason`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `VisitorVisit_signInDeviceId_fkey` FOREIGN KEY (`signInDeviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VisitorVisit_signOutDeviceId_fkey` FOREIGN KEY (`signOutDeviceId`) REFERENCES `Device`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `VisitorVisit_signedOutByUserId_fkey` FOREIGN KEY (`signedOutByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitorRuleAcceptance` (
  `id` CHAR(36) NOT NULL,
  `visitId` CHAR(36) NOT NULL,
  `ruleSetId` CHAR(36) NOT NULL,
  `ruleVersion` INTEGER NOT NULL,
  `acceptedRulesText` TEXT NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisitorRuleAcceptance_visitId_key` (`visitId`),
  INDEX `VisitorRuleAcceptance_ruleSetId_idx` (`ruleSetId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisitorRuleAcceptance_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `VisitorVisit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VisitorRuleAcceptance_ruleSetId_fkey` FOREIGN KEY (`ruleSetId`) REFERENCES `VisitorRuleSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitorSignature` (
  `id` CHAR(36) NOT NULL,
  `visitId` CHAR(36) NOT NULL,
  `strokeData` JSON NOT NULL,
  `pointCount` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `VisitorSignature_visitId_key` (`visitId`),
  INDEX `VisitorSignature_expiresAt_deletedAt_idx` (`expiresAt`,`deletedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisitorSignature_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `VisitorVisit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Production-safe default kiosk configuration
INSERT IGNORE INTO `VisitorReason` (`id`,`label`,`sortOrder`,`active`,`createdAt`,`updatedAt`) VALUES
(UUID(),'Electrical',0,true,NOW(3),NOW(3)),
(UUID(),'Fire safety',1,true,NOW(3),NOW(3)),
(UUID(),'Plumbing',2,true,NOW(3),NOW(3)),
(UUID(),'Maintenance',3,true,NOW(3),NOW(3)),
(UUID(),'Delivery',4,true,NOW(3),NOW(3)),
(UUID(),'Contractor',5,true,NOW(3),NOW(3)),
(UUID(),'Professional visit',6,true,NOW(3),NOW(3)),
(UUID(),'Personal visit',7,true,NOW(3),NOW(3)),
(UUID(),'Meeting',8,true,NOW(3),NOW(3)),
(UUID(),'Other',9,true,NOW(3),NOW(3));

INSERT INTO `VisitorRuleSet` (`id`,`version`,`title`,`rulesText`,`active`,`createdAt`)
SELECT UUID(),1,'Visitor site rules','Please remain with your host unless instructed otherwise. Follow all fire, emergency and safeguarding instructions. Do not photograph or record people on site. Report hazards immediately and wear any required protective equipment. Sign out before leaving the site.',true,NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `VisitorRuleSet`);