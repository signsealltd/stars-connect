ALTER TABLE `StaffPortalAccount` ADD COLUMN `loginLink` CHAR(64) NULL;
CREATE UNIQUE INDEX `StaffPortalAccount_loginLink_key` ON `StaffPortalAccount`(`loginLink`);
