import {expect,it} from "vitest";
import {courseMappingProposal,catalogueImportProposal,newIhascoCourse} from "./ihasco-course-mapping";
const external={externalId:"15943",title:"Fire Safety (Careskills)",courseId:null};
const local={id:"course",name:external.title,evidenceKind:"THEORY",active:true};
it("prepares a unique exact title without changing supplied records",()=>{
  const proposal=courseMappingProposal([external],[local],0);
  expect(proposal.pairs).toEqual([{externalId:"15943",title:external.title,courseId:"course",courseName:local.name}]);
  expect(external.courseId).toBeNull();
  expect(courseMappingProposal([{...external,title:" fire safety   (CARESKILLS) "}],[local],0).pairs).toHaveLength(1);
});
it("leaves different providers, Lite, Awareness and numbered variants for individual review",()=>{
  for(const name of ["Fire Safety (Flexebee)","Fire Safety Lite (Careskills)","Fire Safety Awareness (Careskills)","Fire Safety Level 3 (Careskills)","Fire Safety"])
    expect(courseMappingProposal([external],[{...local,name}],0).pairs).toEqual([]);
});
it("rejects duplicate local/external titles and existing target mappings",()=>{
  expect(courseMappingProposal([external],[local,{...local,id:"other"}],0).pairs).toEqual([]);
  expect(courseMappingProposal([external,{...external,externalId:"2"}],[local],0).pairs).toEqual([]);
  expect(courseMappingProposal([external,{...external,externalId:"2",title:"Already bound",courseId:"course"}],[local],0).pairs).toEqual([]);
  expect(courseMappingProposal([{...external,courseId:"course"}],[local],0).pairs).toEqual([]);
});
it("excludes practical, full-package and inactive requirements",()=>{
  for(const evidenceKind of ["PRACTICAL","EXTERNAL","LOCAL","FULL_TIER2"])
    expect(courseMappingProposal([external],[{...local,evidenceKind}],0).pairs).toEqual([]);
  expect(courseMappingProposal([external],[{...local,active:false}],0).pairs).toEqual([]);
});
it("invalidates the reviewed token when the proposal or mapping revision changes",()=>{
  const token=courseMappingProposal([external],[local],0).token;
  expect(courseMappingProposal([external],[local],1).token).not.toBe(token);
  expect(courseMappingProposal([external],[{...local,id:"replacement"}],0).token).not.toBe(token);
});
it("adds missing variants separately with optional rules and only explicit numbered levels",()=>{
  const variant={...external,externalId:"2",title:"Fire Safety Lite (Careskills)"};
  expect(catalogueImportProposal([external,variant],[local],0).rows.map(r=>r.action)).toEqual(["MATCH","CREATE"]);
  const definition=newIhascoCourse("Fire Safety CPD (Careskills)");
  expect(definition.provider).toBe("Careskills");expect(definition.numberedLevel).toBeNull();expect(definition.renewalMonths).toBeNull();
  expect(new Set(Object.values(definition.requirementRules))).toEqual(new Set(["OPTIONAL"]));
  expect(newIhascoCourse("Food Safety Level 3 (Flexebee)").numberedLevel).toBe(3);
});
it("does not duplicate inactive or similarly named courses during ordinary catalogue import",()=>{
  expect(catalogueImportProposal([external],[{...local,active:false}],0).rows[0].action).toBe("REVIEW");
  expect(catalogueImportProposal([{...external,title:"Fire Safety"}],[local],0).rows[0].action).toBe("REVIEW");
});
it("previews a fresh reset with old online courses archived and protected requirements preserved",()=>{
  const courses=[{...local,active:false},{...local,id:"legacy",name:"Old online subject"},{...local,id:"practical",name:"Medication Practical Competency",evidenceKind:"PRACTICAL"}];
  const reset=catalogueImportProposal([external],courses,0,true);
  expect(reset.rows[0].action).toBe("MATCH");expect(reset.archive).toEqual([{id:"legacy",name:"Old online subject"}]);
  expect(reset.token).not.toBe(catalogueImportProposal([external],courses,0).token);
});
it("reset replaces a differently labelled old online course rather than merging it",()=>{
  const reset=catalogueImportProposal([{...external,title:"Fire Safety"}],[local],0,true);
  expect(reset.rows[0].action).toBe("CREATE");expect(reset.archive[0].id).toBe(local.id);
  expect(catalogueImportProposal([external,{...external,externalId:"2"}],[local],0,true).rows.every(r=>r.action==="REVIEW")).toBe(true);
});
it("reuses linked course IDs on subsequent catalogue setups instead of creating duplicates",()=>{
  const mapped={...external,courseId:local.id};
  expect(catalogueImportProposal([mapped],[local],1).rows[0].action).toBe("LINKED");
  const reset=catalogueImportProposal([mapped],[local],1,true);
  expect(reset.rows[0]).toMatchObject({action:"MATCH",courseId:local.id});expect(reset.archive).toEqual([]);
});
