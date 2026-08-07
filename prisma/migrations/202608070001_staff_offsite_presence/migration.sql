ALTER TABLE SyncEvent
  MODIFY operation ENUM('CLOCK_EVENT', 'STAFF_PRESENCE', 'ATTENDANCE', 'ROLL_CALL_ENTRY', 'VISITOR_SIGN_IN', 'VISITOR_SIGN_OUT') NOT NULL;

CREATE TABLE StaffPresenceEvent (
  id CHAR(36) NOT NULL,
  staffId CHAR(36) NOT NULL,
  deviceId CHAR(36) NOT NULL,
  type ENUM('WENT_OFFSITE', 'RETURNED_ONSITE') NOT NULL,
  deviceTimestamp DATETIME(3) NOT NULL,
  serverReceivedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  offlineRecorded BOOLEAN NOT NULL DEFAULT false,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX StaffPresenceEvent_staffId_deviceTimestamp_idx (staffId, deviceTimestamp),
  INDEX StaffPresenceEvent_serverReceivedAt_idx (serverReceivedAt),
  CONSTRAINT StaffPresenceEvent_staffId_fkey FOREIGN KEY (staffId) REFERENCES StaffMember(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT StaffPresenceEvent_deviceId_fkey FOREIGN KEY (deviceId) REFERENCES Device(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
