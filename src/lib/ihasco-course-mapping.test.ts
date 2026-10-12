import {expect,it} from "vitest";
import {courseMappingProposal} from "./ihasco-course-mapping";
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
