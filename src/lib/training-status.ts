import {renewalDates} from "./ihasco-rules";
import {readPolicy} from "./training-policy";
import {trainingRecordMatchesCourse} from "./training-catalogue";
import {effectiveTrainingRequirement,type TrainingRequirement} from "./training-matrix";
export type AssignmentPolicy={renewalOverrideMonths?:number;renewalOverrideDate?:string;reason?:string;reassessmentAfter?:string;bookedFor?:string;clientPlans?:{clientId:string;planId:string;version:string}[]};
export type EvidenceDetails={assessor?:string;outcome?:string;scope?:string;clientId?:string;planId?:string;planVersion?:string;standards?:string;verifiedPriorAchievement?:boolean;verificationReason?:string;qualification?:string;formalTrainingDate?:string;formalRefresherMonths?:number;refresherDate?:string};
export const objectValue=<T>(value:unknown):T=>(value&&typeof value==="object"&&!Array.isArray(value)?value:{}) as T;
export const londonDay=(value:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
type Course={id:string;name:string;evidenceKind:string;renewalMonths:number|null;policy?:unknown};
type RecordRow={id:string;courseId:string|null;courseName:string;completedDate:Date;expiryDate:Date|null;evidenceDetails?:unknown;externalResult?:{qualifies:boolean;providerExpiryDate:Date|null;completedAt:Date|null}|null};
type Result={courseId:string|null;qualifies:boolean;completedAt:Date|null;statusLabel:string};
export function policyTrainingCell(course:Course,roleRequirement:TrainingRequirement,records:RecordRow[],results:Result[],assignment?:{required:boolean;reason:string|null;policy?:unknown},now=new Date()){
 const requirement=effectiveTrainingRequirement(roleRequirement,assignment?.required),policy=readPolicy(course.policy),override=objectValue<AssignmentPolicy>(assignment?.policy);
 const candidates=records.filter(r=>(!policy.version||r.courseId===course.id)&&trainingRecordMatchesCourse(r,course)&&objectValue<EvidenceDetails>(r.evidenceDetails).outcome!=="FAILED").sort((a,b)=>+b.completedDate-+a.completedDate);
 const record=candidates[0],evidence=objectValue<EvidenceDetails>(record?.evidenceDetails);
 const renewal=record?renewalDates(record.completedDate,record.externalResult?.providerExpiryDate||null,policy.renewalKind==="ONE_OFF"||policy.renewalKind==="ON_PLAN_CHANGE"?null:override.renewalOverrideMonths??course.renewalMonths):{stars:null,applicable:null};
 let expiryDate=renewal.applicable;
 if(record&&!record.externalResult&&record.expiryDate)expiryDate=expiryDate?new Date(Math.min(+expiryDate,+record.expiryDate)):record.expiryDate;
 if(override.renewalOverrideDate&&record){const date=new Date(override.renewalOverrideDate+"T00:00:00Z");expiryDate=record.externalResult?.providerExpiryDate?new Date(Math.min(+date,+record.externalResult.providerExpiryDate)):date;}
 const formalReviewDate=evidence.formalTrainingDate?renewalDates(new Date(evidence.formalTrainingDate),null,evidence.formalRefresherMonths||policy.formalRefresherMonths||null).stars:null;
 if(formalReviewDate)expiryDate=expiryDate?new Date(Math.min(+expiryDate,+formalReviewDate)):formalReviewDate;
 let state:string="MISSING";
 if(requirement==="NOT_REQUIRED")state="NOT_REQUIRED";
 else if(requirement==="CONDITIONAL"||requirement==="INDUCTION")state="REQUIRES_REVIEW";
 else if(record){
  const days=expiryDate?(Date.parse(londonDay(expiryDate))-Date.parse(londonDay(now)))/86400000:Infinity;
  state=days<0?(policy.renewalKind==="REVIEW"?"REVIEW_DUE":"EXPIRED"):days<=60?"DUE_SOON":"CURRENT";
  if(override.reassessmentAfter&&londonDay(record.completedDate)<override.reassessmentAfter)state="REQUIRES_REVIEW";
  if(policy.renewalKind==="ON_PLAN_CHANGE"){
   const plans=override.clientPlans||[];
   state=!plans.length?"REQUIRES_REVIEW":plans.every(plan=>candidates.some(r=>{const e=objectValue<EvidenceDetails>(r.evidenceDetails);return e.clientId===plan.clientId&&e.planId===plan.planId&&e.planVersion===plan.version;}))?"CURRENT":"REQUIRES_REVIEW";
  }
 }else{
  const relevant=results.filter(r=>r.courseId===course.id);
  if(relevant.some(r=>r.qualifies&&!r.completedAt))state="REQUIRES_REVIEW";
  else if(relevant.some(r=>/in.?progress|content viewed/i.test(r.statusLabel)))state="IN_PROGRESS";
  else if(override.bookedFor)state="BOOKED";
 }
 return {courseId:course.id,requirement,state,assignment:assignment?.required??null,assignmentReason:assignment?.reason||"",assignmentPolicy:override,recordId:record?.id||null,completedDate:record?.completedDate||null,expiryDate,policyRenewalDate:renewal.stars,providerExpiryDate:record?.externalResult?.providerExpiryDate||null,evidenceKind:course.evidenceKind,renewalKind:policy.renewalKind||"RENEWAL",bookedFor:override.bookedFor||null,formalReviewDate:evidence.formalTrainingDate?renewalDates(new Date(evidence.formalTrainingDate),null,evidence.formalRefresherMonths||policy.formalRefresherMonths||null).stars:null,annualReminderDate:record&&policy.annualReminderMonths?renewalDates(new Date(evidence.refresherDate||record.completedDate),null,policy.annualReminderMonths).stars:null};
}
export function compositeTrainingStatus(cells:{courseId:string;state:string}[],courses:Course[]){
 const inDate=(state?:string)=>state==="CURRENT"||state==="DUE_SOON";
 return [{name:"Oliver McGowan Tier 2",components:["OLIVER_ONLINE","OLIVER_FACE_TO_FACE"]},{name:"Care Certificate overall",components:["CARE_ONLINE","CARE_WORKPLACE"]}].map(group=>{
  const states=group.components.map(component=>cells.find(cell=>cell.courseId===courses.find(c=>readPolicy(c.policy).component===component)?.id)?.state);
  return {name:group.name,state:states.every(inDate)?states.includes("DUE_SOON")?"DUE_SOON":"CURRENT":states.some(inDate)?"PART_COMPLETE":states.some(s=>s==="REQUIRES_REVIEW")?"REQUIRES_REVIEW":"MISSING"};
 });
}
export const trainingStatusLabels:Record<string,string>={CURRENT:"Current",DUE_SOON:"Due soon",EXPIRED:"Overdue",MISSING:"Not completed",NOT_REQUIRED:"Not required",REQUIRES_REVIEW:"Requires review",REVIEW_DUE:"Review due",IN_PROGRESS:"In progress",BOOKED:"Booked",PART_COMPLETE:"Part complete",OPTIONAL:"Optional",CONDITIONAL:"Requires review",INDUCTION:"Requires review"};
