// Generates reviewed, insert-only catalogue data. Never reads a database or staff records.
import fs from "node:fs";
import path from "node:path";
import { proposedTrainingCatalogue, protectedTrainingEntries } from "../src/lib/training-catalogue";

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const dir = path.resolve("prisma/migrations/202610090002_training_catalogue");
const schema = `-- Preserve every existing course and staff completion. New nullable metadata only.
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
`;
const statements: string[] = [];
for (const provider of new Set(proposedTrainingCatalogue.map(c => c.provider))) {
  statements.push(`INSERT INTO TrainingProvider (id,name,createdAt,updatedAt)
SELECT UUID(),${quote(provider)},CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingProvider WHERE name=${quote(provider)});`);
}
function insertCourse(course: {key: string;name: string;kind: string;category: string;rules: Record<string,string>;description: string;priority?: string;level?: number|null;source: string}) {
  statements.push(`INSERT INTO TrainingCourse (id,name,category,description,catalogueKey,numberedLevel,atlasCourseId,integrationSource,priority,evidenceKind,renewalMonths,warningDays,requirementRules,active,createdAt,updatedAt)
SELECT UUID(),${quote(course.name)},${quote(course.category)},${quote(course.description)},${quote(course.key)},${course.level??"NULL"},NULL,${quote(course.source)},${course.priority?quote(course.priority):"NULL"},${quote(course.kind)},NULL,60,${quote(JSON.stringify(course.rules))},1,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM TrainingCourse WHERE name=${quote(course.name)} OR catalogueKey=${quote(course.key)});`);
}
for (const c of proposedTrainingCatalogue) {
  insertCourse({key:c.key,name:c.name,kind:"THEORY",category:"STARS proposed training plan",rules:c.requirementRules,description:`Proposed STARS role requirements, not provider-confirmed legal requirements. ${c.reviewNote} Refresher period unconfirmed.`,priority:c.priority,level:c.numberedLevel,source:"STARS proposed CSV"});
  statements.push(`INSERT INTO TrainingCourseProvider (courseId,providerId,preferred)
SELECT c.id,p.id,true FROM TrainingCourse c JOIN TrainingProvider p ON p.name=${quote(c.provider)}
WHERE c.catalogueKey=${quote(c.key)} AND NOT EXISTS (SELECT 1 FROM TrainingCourseProvider link WHERE link.courseId=c.id AND link.providerId=p.id);`);
}
// Missing protected titles are distinct records; similar legacy names are never reused.
for (const [index,c] of protectedTrainingEntries.entries()) {
  insertCourse({key:`stars-local-2026-${index+1}`,name:c.name,kind:c.evidenceKind,category:"Local, practical and external training",rules:{"Support Worker":c.name==="STARS Local Induction"?"INDUCTION":"CONDITIONAL","Team Leader":"CONDITIONAL",Manager:"CONDITIONAL"},description:"Separate STARS local, practical or external evidence. Confirm individual responsibilities before assigning. No Atlas theory equivalence or historical completion transfer.",source:"STARS protected requirements"});
}
insertCourse({key:"stars-oliver-full-tier2",name:"Oliver McGowan Tier 2 Full Package",kind:"FULL_TIER2",category:"Local, practical and external training",rules:{"Support Worker":"REQUIRED","Team Leader":"REQUIRED",Manager:"REQUIRED"},description:"Proposed STARS requirement. Manager must verify both online and face-to-face completion evidence. An online module or a face-to-face session alone does not complete this package.",source:"STARS proposed training plan"});
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,"migration.sql"),schema+statements.join("\n\n")+"\nCOMMIT;\n");
console.log(`Generated insert-only import for ${proposedTrainingCatalogue.length} provider courses, protected records where absent, and the separate Tier 2 package.`);
