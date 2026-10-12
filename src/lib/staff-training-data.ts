import {prisma} from "./prisma";
import {externalTrainingSelect,externalTrainingView} from "./external-training-view";

export async function staffTrainingData(staffId:string,organisationId:string) {
  const [records,uncredited]=await Promise.all([
    prisma.staffTrainingRecord.findMany({where:{staffId,active:true},select:{id:true,courseName:true,provider:true,completedDate:true,expiryDate:true,mandatory:true,certificateReference:true,course:{select:{renewalMonths:true}},externalResult:{select:externalTrainingSelect}},orderBy:{completedDate:"desc"}}),
    prisma.trainingExternalResult.findMany({where:{staffId,integration:{organisationId},trainingRecordId:null},select:{id:true,courseTitle:true,completedAt:true,providerExpiryDate:true,starsExpiryDate:true,score:true,passMark:true,attempts:true,statusLabel:true,qualifies:true,certificateState:true,certificateError:true},orderBy:{completedAt:"desc"}}),
  ]);
  return [...records.map(externalTrainingView),...uncredited.map(r=>({id:`ihasco-${r.id}`,courseName:r.courseTitle,provider:"iHasco",completedDate:r.completedAt,expiryDate:null,mandatory:false,certificateReference:null,externalResult:{...r,qualifies:false}}))];
}
