-- Additive storage for the authoritative snapshot used by corrected invoice versions.
-- Existing invoices remain unchanged and continue to use their original source records.
ALTER TABLE `Invoice` ADD COLUMN `reissueData` JSON NULL;
