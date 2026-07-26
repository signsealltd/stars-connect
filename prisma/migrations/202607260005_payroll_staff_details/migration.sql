ALTER TABLE `StaffMember` ADD COLUMN `hourlyRate` DECIMAL(10, 2) NULL AFTER `contractedWeeklyHours`;
ALTER TABLE `PayrollEntry` ADD COLUMN `hourlyRate` DECIMAL(10, 2) NULL AFTER `payrollNumber`, ADD COLUMN `grossPay` DECIMAL(12, 2) NULL AFTER `hourlyRate`;
