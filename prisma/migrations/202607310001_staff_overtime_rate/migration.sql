ALTER TABLE `StaffMember`
  ADD COLUMN `overtimeHourlyRate` DECIMAL(10, 2) NULL AFTER `hourlyRate`;

ALTER TABLE `PayrollEntry`
  ADD COLUMN `overtimeHourlyRate` DECIMAL(10, 2) NULL AFTER `hourlyRate`;