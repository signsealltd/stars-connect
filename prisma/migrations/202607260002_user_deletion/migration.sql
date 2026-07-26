ALTER TABLE `ClockCorrection` 
  DROP FOREIGN KEY `ClockCorrection_managerId_fkey`,
  MODIFY `managerId` CHAR(36) NULL,
  ADD CONSTRAINT `ClockCorrection_managerId_fkey`
    FOREIGN KEY (`managerId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
