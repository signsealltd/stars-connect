import {readPolicy} from "./training-policy";
import type {EvidenceDetails} from "./training-status";
import {prisma} from "./prisma";
import {trainingRoles,type RequirementRules,mandatoryTrainingCounts} from "./training-matrix";
import {externalTrainingSelect} from "./external-training-view";
import {policyTrainingCell,compositeTrainingStatus,objectValue,type AssignmentPolicy} from "./training-status";
export async function trainingStatusData(organisationId:string,staffId?:string){
 const [staff,courses,records,assignments,results]=await Promise.all([
  prisma.staffMember.findMany({where:{...(staffId?{id:staffId}:{active:true,archivedAt:null})},select:{id:true,firstName:true,lastName:true,displayName:true,jobRole:true},orderBy:[{sortOrder:"asc"},{displayName:"asc"}]}),
  prisma.trainingCourse.findMany({where:{active:true},orderBy:[{category:"asc"},{name:"asc"}]}),
  prisma.staffTrainingRecord.findMany({where:{...(staffId?{staffId}:{}),active:true,OR:[{externalResult:null},{externalResult:{integration:{organisationId}}}]},include:{externalResult:{select:externalTrainingSelect}},orderBy:{completedDate:"desc"}}),
  prisma.staffTrainingAssignment.findMany({where:staffId?{staffId}:{}}),
  prisma.trainingExternalResult.findMany({where:{...(staffId?{staffId}:{}),integration:{organisationId}},select:{staffId:true,courseId:true,qualifies:true,completedAt:true,statusLabel:true}}),
 ]);
 const planIds=assignments.flatMap(a=>objectValue<AssignmentPolicy>(a.policy).clientPlans?.map(p=>p.planId)||[]);
 const published=planIds.length?await prisma.complianceRecord.findMany({where:{id:{in:planIds},organisationId,archivedAt:null},select:{id:true,publishedVersionNumber:true}}):[];
 const rows=staff.map(person=>{
  const role=[...trainingRoles].sort((a,b)=>b.length-a.length).find(r=>person.jobRole.toLowerCase().includes(r.toLowerCase()))||"Unrecognised role";
  const cells=courses.map(course=>{
   const assignment=assignments.find(a=>a.staffId===person.id&&a.courseId===course.id),policy=objectValue<AssignmentPolicy>(assignment?.policy);
   const effective=assignment?{...assignment,policy:{...policy,clientPlans:policy.clientPlans?.map(plan=>({...plan,version:String(published.find(p=>p.id===plan.planId)?.publishedVersionNumber??plan.version)}))}}:undefined;
   return policyTrainingCell(course,(course.requirementRules as RequirementRules)[role]||"CONDITIONAL",records.filter(r=>r.staffId===person.id),results.filter(r=>r.staffId===person.id),effective);
  });
  const prior=records.find(r=>r.staffId===person.id&&readPolicy(courses.find(c=>c.id===r.courseId)?.policy).component==="CARE_WORKPLACE"&&objectValue<EvidenceDetails>(r.evidenceDetails).verifiedPriorAchievement);
  const reassessmentRequested=prior&&assignments.some(a=>a.staffId===person.id&&["CARE_WORKPLACE","CARE_ONLINE"].includes(readPolicy(courses.find(c=>c.id===a.courseId)?.policy).component||"")&&String(objectValue<AssignmentPolicy>(a.policy).reassessmentAfter||"")>prior.completedDate.toISOString().slice(0,10));
  if(prior&&!reassessmentRequested){const online=cells.find(cell=>readPolicy(courses.find(c=>c.id===cell.courseId)?.policy).component==="CARE_ONLINE");if(online&&online.requirement!=="NOT_REQUIRED"){online.state="CURRENT";online.completedDate=prior.completedDate;online.expiryDate=null;}}
  const composites=compositeTrainingStatus(cells,courses);if(prior&&!reassessmentRequested){const care=composites.find(c=>c.name==="Care Certificate overall");if(care)care.state="CURRENT";}
  return {id:person.id,name:`${person.firstName} ${person.lastName}`.trim()||person.displayName,role,cells,composites};
 });
 return {courses,rows,counts:mandatoryTrainingCounts(rows.flatMap(r=>r.cells))};
}
