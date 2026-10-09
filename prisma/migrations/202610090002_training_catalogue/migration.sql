-- Preserve every existing course and staff completion. New nullable metadata only.
ALTER TABLE TrainingProvider MODIFY createdById CHAR(36) NULL, MODIFY updatedById CHAR(36) NULL;
ALTER TABLE TrainingCourse
  ADD COLUMN catalogueKey VARCHAR(100) NULL,
  ADD COLUMN numberedLevel INT NULL,
  ADD COLUMN atlasCourseId VARCHAR(191) NULL,
  ADD COLUMN integrationSource VARCHAR(100) NULL,
  ADD COLUMN priority VARCHAR(40) NULL,
  ADD COLUMN evidenceKind VARCHAR(40) NOT NULL DEFAULT 'COURSE',
  ADD UNIQUE INDEX TrainingCourse_catalogueKey_key (catalogueKey);
ALTER TABLE StaffTrainingRecord ADD COLUMN fullTier2Verified BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE StaffTrainingAssignment (
  id CHAR(36) NOT NULL,
  staffId CHAR(36) NOT NULL,
  courseId CHAR(36) NOT NULL,
  required BOOLEAN NOT NULL,
  reason VARCHAR(1000) NULL,
  updatedById CHAR(36) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX StaffTrainingAssignment_staffId_courseId_key (staffId, courseId),
  INDEX StaffTrainingAssignment_courseId_idx (courseId),
  CONSTRAINT StaffTrainingAssignment_staffId_fkey FOREIGN KEY (staffId) REFERENCES StaffMember(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT StaffTrainingAssignment_courseId_fkey FOREIGN KEY (courseId) REFERENCES TrainingCourse(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Approved separate-course import. No UPDATE, DELETE, rename, merge or completion transfer.
-- Exact-name collisions are retained unchanged for manager review, not silently adopted.
START TRANSACTION;
INSERT INTO TrainingProvider (id,name,createdAt,updatedAt)
SELECT UUID(),'Careskills',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingProvider WHERE name='Careskills');

INSERT INTO TrainingProvider (id,name,createdAt,updatedAt)
SELECT UUID(),'Flexebee',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingProvider WHERE name='Flexebee');

INSERT INTO TrainingProvider (id,name,createdAt,updatedAt)
SELECT UUID(),'Confirm with Atlas',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingProvider WHERE name='Confirm with Atlas');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Safeguarding and Protection of Adults (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Review broad subject; do not replace with Level 3. Refresher period unconfirmed.','stars-plan-2026-01',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Safeguarding and Protection of Adults (Careskills)' OR catalogueKey='stars-plan-2026-01');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-01' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Safeguarding of Adults Level 3 CSTF Aligned (Flexebee)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Separate Level 3 variant; manager must confirm any mapping. Refresher period unconfirmed.','stars-plan-2026-02',3,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Safeguarding of Adults Level 3 CSTF Aligned (Flexebee)' OR catalogueKey='stars-plan-2026-02');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Flexebee'
WHERE c.catalogueKey='stars-plan-2026-02' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Health and Safety (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-03',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Health and Safety (Careskills)' OR catalogueKey='stars-plan-2026-03');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-03' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Fire Safety (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Keep site familiarisation and evacuation evidence separate. Refresher period unconfirmed.','stars-plan-2026-04',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Fire Safety (Careskills)' OR catalogueKey='stars-plan-2026-04');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-04' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Infection Control (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-05',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Infection Control (Careskills)' OR catalogueKey='stars-plan-2026-05');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-05' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Mental Capacity (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-06',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Mental Capacity (Careskills)' OR catalogueKey='stars-plan-2026-06');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-06' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'The Oliver McGowan Mandatory Training','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Confirm Atlas course scope and provider. No automatic equivalence to either part or full Tier 2; face-to-face remains separate. Refresher period unconfirmed.','stars-plan-2026-07',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='The Oliver McGowan Mandatory Training' OR catalogueKey='stars-plan-2026-07');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Confirm with Atlas'
WHERE c.catalogueKey='stars-plan-2026-07' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Learning Disability (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Awareness variant: explicit manager review, no automatic merge. Refresher period unconfirmed.','stars-plan-2026-08',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Learning Disability (Careskills)' OR catalogueKey='stars-plan-2026-08');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-08' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Autism (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Awareness variant: explicit manager review, no automatic merge. Refresher period unconfirmed.','stars-plan-2026-09',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Autism (Careskills)' OR catalogueKey='stars-plan-2026-09');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-09' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'GDPR 1 (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. GDPR 1 and GDPR 2 compete for broad subject; manager selection required. 1 is not a qualification level. Refresher period unconfirmed.','stars-plan-2026-10',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='GDPR 1 (Careskills)' OR catalogueKey='stars-plan-2026-10');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-10' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Epilepsy Awareness (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Review exact provider and variant. Refresher period unconfirmed.','stars-plan-2026-11',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Epilepsy Awareness (Careskills)' OR catalogueKey='stars-plan-2026-11');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-11' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Buccal Midazolam (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Add separate theory course; preserve existing combined/practical evidence without relinking. Refresher period unconfirmed.','stars-plan-2026-12',NULL,NULL,'STARS proposed CSV','Immediate','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Buccal Midazolam (Careskills)' OR catalogueKey='stars-plan-2026-12');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-12' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Person Centred Care (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-13',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Person Centred Care (Careskills)' OR catalogueKey='stars-plan-2026-13');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-13' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Positive Behaviour Support (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Existing numbered variant stays separate pending explicit review; new title has no numbered level. Refresher period unconfirmed.','stars-plan-2026-14',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Positive Behaviour Support (Careskills)' OR catalogueKey='stars-plan-2026-14');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-14' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Behaviours that Challenge (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course; do not equate with PBS. Refresher period unconfirmed.','stars-plan-2026-15',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Behaviours that Challenge (Careskills)' OR catalogueKey='stars-plan-2026-15');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-15' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Communication (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-16',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Communication (Careskills)' OR catalogueKey='stars-plan-2026-16');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-16' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Recording Information (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-17',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Recording Information (Careskills)' OR catalogueKey='stars-plan-2026-17');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-17' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Duty of Care (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-18',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Duty of Care (Careskills)' OR catalogueKey='stars-plan-2026-18');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-18' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Equality, Diversity, Inclusion (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-19',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Equality, Diversity, Inclusion (Careskills)' OR catalogueKey='stars-plan-2026-19');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-19' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Basic Life Support (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Confirm practical scope; never overwrite First Aid at Work or Emergency First Aid at Work. Refresher period unconfirmed.','stars-plan-2026-20',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Basic Life Support (Careskills)' OR catalogueKey='stars-plan-2026-20');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-20' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Mental Health (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Awareness variant: explicit manager review, no automatic merge. Refresher period unconfirmed.','stars-plan-2026-21',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Mental Health (Careskills)' OR catalogueKey='stars-plan-2026-21');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-21' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Whistleblowing (Flexebee)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-22',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Whistleblowing (Flexebee)' OR catalogueKey='stars-plan-2026-22');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Flexebee'
WHERE c.catalogueKey='stars-plan-2026-22' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Risk Assessment (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-23',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Risk Assessment (Careskills)' OR catalogueKey='stars-plan-2026-23');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-23' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Care Planning (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-24',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Care Planning (Careskills)' OR catalogueKey='stars-plan-2026-24');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-24' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'GDPR 2 (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. GDPR 1 and GDPR 2 compete for broad subject; manager selection required. 2 is not a qualification level. Refresher period unconfirmed.','stars-plan-2026-25',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='GDPR 2 (Careskills)' OR catalogueKey='stars-plan-2026-25');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-25' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Cyber Security Awareness (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-26',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Cyber Security Awareness (Careskills)' OR catalogueKey='stars-plan-2026-26');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-26' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Supervision (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Confirm scope; Support Worker optional excluded from mandatory totals. Refresher period unconfirmed.','stars-plan-2026-27',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"OPTIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Supervision (Careskills)' OR catalogueKey='stars-plan-2026-27');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-27' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Complaints Handling (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-28',NULL,NULL,'STARS proposed CSV','Next','THEORY',NULL,60,'{"Support Worker":"OPTIONAL","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Complaints Handling (Careskills)' OR catalogueKey='stars-plan-2026-28');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-28' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Medication Practice (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Ambiguous subjects/variants: manager selection; practical competency always remains separate. Refresher period unconfirmed.','stars-plan-2026-29',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Medication Practice (Careskills)' OR catalogueKey='stars-plan-2026-29');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-29' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Diabetes Awareness (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Review exact provider and variant. Refresher period unconfirmed.','stars-plan-2026-30',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Diabetes Awareness (Careskills)' OR catalogueKey='stars-plan-2026-30');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-30' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Moving and Handling (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Confirm people-handling scope versus objects course; practical competency remains separate. Refresher period unconfirmed.','stars-plan-2026-31',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Moving and Handling (Careskills)' OR catalogueKey='stars-plan-2026-31');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-31' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Manual Handling of Objects (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Do not equate people and objects courses; manager must resolve broad existing subject. Refresher period unconfirmed.','stars-plan-2026-32',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Manual Handling of Objects (Careskills)' OR catalogueKey='stars-plan-2026-32');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-32' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Food Hygiene (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-33',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Food Hygiene (Careskills)' OR catalogueKey='stars-plan-2026-33');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-33' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Allergen Awareness (Flexebee)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-34',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Allergen Awareness (Flexebee)' OR catalogueKey='stars-plan-2026-34');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Flexebee'
WHERE c.catalogueKey='stars-plan-2026-34' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Lone Working (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-35',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Lone Working (Careskills)' OR catalogueKey='stars-plan-2026-35');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-35' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Conflict Resolution (Flexebee)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Confirm course scope; combined subject is not automatic equivalence. Refresher period unconfirmed.','stars-plan-2026-36',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Conflict Resolution (Flexebee)' OR catalogueKey='stars-plan-2026-36');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Flexebee'
WHERE c.catalogueKey='stars-plan-2026-36' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'COSHH (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Candidate for manager review. Refresher period unconfirmed.','stars-plan-2026-37',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='COSHH (Careskills)' OR catalogueKey='stars-plan-2026-37');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-37' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'RIDDOR (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-38',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"OPTIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='RIDDOR (Careskills)' OR catalogueKey='stars-plan-2026-38');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-38' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Dysphagia (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Propose separate new course. Refresher period unconfirmed.','stars-plan-2026-39',NULL,NULL,'STARS proposed CSV','Role-specific','THEORY',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Dysphagia (Careskills)' OR catalogueKey='stars-plan-2026-39');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-39' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Care Certificate (Careskills)','STARS proposed training plan','Proposed STARS role requirements, not provider-confirmed legal requirements. Separate theory course for relevant new starters; local induction and workplace assessment remain separate. Refresher period unconfirmed.','stars-plan-2026-40',NULL,NULL,'STARS proposed CSV','Induction','THEORY',NULL,60,'{"Support Worker":"INDUCTION","Team Leader":"INDUCTION","Manager":"INDUCTION"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Care Certificate (Careskills)' OR catalogueKey='stars-plan-2026-40');

INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name='Careskills'
WHERE c.catalogueKey='stars-plan-2026-40' AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'STARS Local Induction','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-1',NULL,NULL,'STARS protected requirements',NULL,'LOCAL',NULL,60,'{"Support Worker":"INDUCTION","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='STARS Local Induction' OR catalogueKey='stars-local-2026-1');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Medication Practical Competency','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-2',NULL,NULL,'STARS protected requirements',NULL,'PRACTICAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Medication Practical Competency' OR catalogueKey='stars-local-2026-2');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Buccal Midazolam Practical Competency','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-3',NULL,NULL,'STARS protected requirements',NULL,'PRACTICAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Buccal Midazolam Practical Competency' OR catalogueKey='stars-local-2026-3');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Moving and Handling Practical Competency','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-4',NULL,NULL,'STARS protected requirements',NULL,'PRACTICAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Moving and Handling Practical Competency' OR catalogueKey='stars-local-2026-4');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'First Aid at Work','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-5',NULL,NULL,'STARS protected requirements',NULL,'EXTERNAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='First Aid at Work' OR catalogueKey='stars-local-2026-5');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Emergency First Aid at Work','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-6',NULL,NULL,'STARS protected requirements',NULL,'EXTERNAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Emergency First Aid at Work' OR catalogueKey='stars-local-2026-6');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Oliver McGowan Tier 2 Face-to-Face Session','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-7',NULL,NULL,'STARS protected requirements',NULL,'PRACTICAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Oliver McGowan Tier 2 Face-to-Face Session' OR catalogueKey='stars-local-2026-7');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Care Certificate Workplace Assessment','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-8',NULL,NULL,'STARS protected requirements',NULL,'PRACTICAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Care Certificate Workplace Assessment' OR catalogueKey='stars-local-2026-8');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Missing Person and Herbert Protocol','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-9',NULL,NULL,'STARS protected requirements',NULL,'LOCAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Missing Person and Herbert Protocol' OR catalogueKey='stars-local-2026-9');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Driving for Business','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-10',NULL,NULL,'STARS protected requirements',NULL,'LOCAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Driving for Business' OR catalogueKey='stars-local-2026-10');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Fire Evacuation and Site Familiarisation','Local, practical and external training','Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.','stars-local-2026-11',NULL,NULL,'STARS protected requirements',NULL,'LOCAL',NULL,60,'{"Support Worker":"CONDITIONAL","Team Leader":"CONDITIONAL","Manager":"CONDITIONAL"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Fire Evacuation and Site Familiarisation' OR catalogueKey='stars-local-2026-11');

INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),'Oliver McGowan Tier 2 Full Package','Local, practical and external training','Proposed STARS requirement. Manager must verify both online and face-to-face completion evidence. An online module or a face-to-face session alone does not complete this package.','stars-oliver-full-tier2',NULL,NULL,'STARS proposed training plan',NULL,'FULL_TIER2',NULL,60,'{"Support Worker":"REQUIRED","Team Leader":"REQUIRED","Manager":"REQUIRED"}',1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name='Oliver McGowan Tier 2 Full Package' OR catalogueKey='stars-oliver-full-tier2');
COMMIT;
