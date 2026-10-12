import {trainingStatusData} from "./training-status-data";
import {trainingStatusLabels} from "./training-status";
import {prisma} from "./prisma";
import {externalTrainingSelect,externalTrainingView} from "./external-training-view";

export async function staffTrainingData(staffId:string,organisationId:string) {
  const [records,uncredited,status]=await Promise.all([
    prisma.staffTrainingRecord.findMany({where:{staffId,active:true},select:{id:true,courseId:true,courseName:true,provider:true,completedDate:true,expiryDate:true,mandatory:true,certificateReference:true,course:{select:{renewalMonths:true,policy:true}},externalResult:{select:externalTrainingSelect}},orderBy:{completedDate:"desc"}}),
    prisma.trainingExternalResult.findMany({where:{staffId,integration:{organisationId},trainingRecordId:null},select:{id:true,courseId:true,courseTitle:true,completedAt:true,providerExpiryDate:true,starsExpiryDate:true,score:true,passMark:true,attempts:true,statusLabel:true,qualifies:true,certificateState:true,certificateError:true},orderBy:{completedAt:"desc"}}),
    trainingStatusData(organisationId,staffId),
  ]);
  const cells=status.rows[0]?.cells||[];
  const summaries=cells.filter(c=>c.requirement!=="NOT_REQUIRED").map(cell=>{const course=status.courses.find(c=>c.id===cell.courseId)!;const record=records.find(r=>r.id===cell.recordId);return {id:record?.id||`requirement-${cell.courseId}`,courseName:course.name,provider:record?.provider||"",completedDate:cell.completedDate,expiryDate:cell.expiryDate,mandatory:cell.requirement==="REQUIRED",certificateReference:record?.certificateReference||null,externalResult:record?.externalResult,trainingStatus:trainingStatusLabels[cell.state],evidenceKind:cell.evidenceKind,renewalKind:cell.renewalKind,bookedFor:cell.bookedFor,formalReviewDate:cell.formalReviewDate,annualReminderDate:cell.annualReminderDate};});
  return [...summaries,...(status.rows[0]?.composites||[]).map(item=>({id:`composite-${item.name}`,courseName:item.name,provider:"Derived from training components",completedDate:null,expiryDate:null,mandatory:false,certificateReference:null,trainingStatus:trainingStatusLabels[item.state]})),...records.filter(r=>!cells.some(c=>c.recordId===r.id)).map(externalTrainingView),...uncredited.filter(r=>cells.some(c=>c.courseId===r.courseId)).map(r=>({id:`ihasco-${r.id}`,courseName:r.courseTitle,provider:"iHasco",completedDate:r.completedAt,expiryDate:null,mandatory:false,certificateReference:null,externalResult:{...r,qualifies:false}}))];
}
