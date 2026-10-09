import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { explicitNumberedLevel, proposedTrainingCatalogue, protectedTrainingEntries, tier2EvidenceError, trainingRecordMatchesCourse } from "./training-catalogue";
import { effectiveTrainingRequirement, mandatoryTrainingCounts, trainingState, type TrainingRequirement } from "./training-matrix";

describe("reviewed STARS catalogue", () => {
  it("keeps all 40 titles, providers and variants with only explicitly numbered levels", () => {
    expect(proposedTrainingCatalogue).toHaveLength(40);
    expect(new Set(proposedTrainingCatalogue.map(c=>c.name)).size).toBe(40);
    expect(proposedTrainingCatalogue.filter(c=>c.numberedLevel!==null).map(c=>[c.name,c.numberedLevel])).toEqual([["Safeguarding of Adults Level 3 CSTF Aligned (Flexebee)",3]]);
    for (const c of proposedTrainingCatalogue) expect(c.numberedLevel).toBe(explicitNumberedLevel(c.name));
    expect(explicitNumberedLevel("GDPR 2 (Careskills)")).toBeNull();
    expect(explicitNumberedLevel("CPD accredited")).toBeNull();
    expect(proposedTrainingCatalogue.find(c=>c.name==="The Oliver McGowan Mandatory Training")?.provider).toBe("Confirm with Atlas");
    expect(proposedTrainingCatalogue.find(c=>c.name==="Care Certificate (Careskills)")?.requirementRules["Support Worker"]).toBe("INDUCTION");
    expect(proposedTrainingCatalogue.find(c=>c.name==="Supervision (Careskills)")?.requirementRules["Support Worker"]).toBe("OPTIONAL");
    expect(protectedTrainingEntries).toHaveLength(11);
    expect(protectedTrainingEntries.every(c=>!proposedTrainingCatalogue.some(p=>p.name===c.name))).toBe(true);
  });

  it("uses insert-only migration data and leaves existing evidence and expiry periods untouched", () => {
    const sql=fs.readFileSync("prisma/migrations/202610090002_training_catalogue/migration.sql","utf8");
    expect(sql).not.toMatch(/^(UPDATE|DELETE|REPLACE)\s/im);
    expect(sql).not.toMatch(/INSERT INTO StaffTrainingRecord/i);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql.match(/INSERT INTO TrainingCourse \(/g)).toHaveLength(52);
    expect(sql.match(/INSERT INTO TrainingCourseProvider/g)).toHaveLength(40);
    expect(sql.match(/NULL,60,/g)).toHaveLength(52);
    for (const c of proposedTrainingCatalogue) {
      expect(sql).toContain(`name='${c.name.replace(/'/g,"''")}' OR catalogueKey='${c.key}'`);
      expect(sql).toContain(`WHERE c.catalogueKey='${c.key}'`);
    }
  });
});

describe("training evidence isolation", () => {
  const course={id:"provider-course",name:"Medication Practice (Careskills)",catalogueKey:"stars-plan-2026-29",evidenceKind:"THEORY"};
  it("does not award imported-course credit from a title or another course's evidence",()=>{
    expect(trainingRecordMatchesCourse({courseName:course.name},course)).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:"practical-course",courseName:course.name},course)).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:course.id,courseName:course.name},course)).toBe(true);
    expect(trainingRecordMatchesCourse({courseName:"First Aid at Work"},{id:"legacy",name:"First Aid at Work"})).toBe(true);
  });
  it("requires separate full-package evidence, not just an online module or face-to-face session",()=>{
    const full={id:"full",name:"Oliver McGowan Tier 2 Full Package",evidenceKind:"FULL_TIER2"};
    expect(trainingRecordMatchesCourse({courseId:"online",courseName:full.name,fullTier2Verified:true,certificateReference:"online"},full)).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:full.id,courseName:full.name,certificateReference:"online"},full)).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:full.id,courseName:full.name,fullTier2Verified:true,certificateReference:"online + face-to-face evidence"},full)).toBe(true);
    expect(tier2EvidenceError(full,{fullTier2Verified:true,certificateReference:" "})).not.toBeNull();
    expect(tier2EvidenceError(full,{fullTier2Verified:false,certificateReference:"online"})).not.toBeNull();
    expect(tier2EvidenceError(full,{fullTier2Verified:true,certificateReference:"both"})).toBeNull();
    expect(tier2EvidenceError({name:"The Oliver McGowan Mandatory Training",evidenceKind:"THEORY"},{fullTier2Verified:true,certificateReference:"both"})).not.toBeNull();
  });
});

describe("individual training requirements",()=>{
  it("keeps optional, induction and conditional courses out of mandatory totals until assigned",()=>{
    const requirements:TrainingRequirement[]=["OPTIONAL","CONDITIONAL","INDUCTION"];
    const cells=requirements.flatMap(requirement=>[{requirement,state:"CURRENT"},{requirement,state:"EXPIRED"}]);
    expect(mandatoryTrainingCounts(cells)).toEqual({});
    for(const requirement of requirements){
      expect(trainingState({requirement})).toBe(requirement);
      const assigned=effectiveTrainingRequirement(requirement,true);
      expect(assigned).toBe("REQUIRED");
      expect(trainingState({requirement:assigned})).toBe("MISSING");
      expect(effectiveTrainingRequirement(requirement,null)).toBe(requirement);
    }
    expect(mandatoryTrainingCounts([...cells,{requirement:"REQUIRED",state:"MISSING"},{requirement:"REQUIRED",state:"CURRENT"}])).toEqual({MISSING:1,CURRENT:1});
  });
  it("supports individual exemptions and returning to the role default",()=>{
    expect(effectiveTrainingRequirement("REQUIRED",false)).toBe("NOT_REQUIRED");
    expect(effectiveTrainingRequirement("REQUIRED",null)).toBe("REQUIRED");
  });
});
