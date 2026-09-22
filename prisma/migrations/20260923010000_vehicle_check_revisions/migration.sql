ALTER TABLE VehicleCheck ADD COLUMN supersedesId CHAR(36) NULL, ADD COLUMN rootCheckId CHAR(36) NULL, ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX VehicleCheck_supersedesId_key ON VehicleCheck(supersedesId);
CREATE INDEX VehicleCheck_rootCheckId_idx ON VehicleCheck(rootCheckId);
ALTER TABLE VehicleCheck ADD CONSTRAINT VehicleCheck_supersedesId_fkey FOREIGN KEY (supersedesId) REFERENCES VehicleCheck(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
