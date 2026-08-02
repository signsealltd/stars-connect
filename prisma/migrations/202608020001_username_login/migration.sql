ALTER TABLE `User` ADD COLUMN `username` VARCHAR(32) NULL;

UPDATE `User`
SET `username` = CONCAT('user-', LEFT(REPLACE(`id`, '-', ''), 12))
WHERE `username` IS NULL;

ALTER TABLE `User`
  MODIFY `username` VARCHAR(32) NOT NULL,
  MODIFY `email` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `User_username_key` (`username`);