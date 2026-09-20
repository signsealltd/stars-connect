import {prisma} from "./prisma";
import {qualifyingAbsences,type AbsencePolicy} from "./safeguarding";
export async function refreshSafeguarding(){
 const setting=await prisma.appSetting.findUnique({where:{key:"absencePolicy"}});
 const value=setting?.value as {mode?:string;windowDays?:number}|null;
 const policy:AbsencePolicy={mode:value?.mode==="CONSECUTIVE"?"CONSECUTIVE":"ACCUMULATED",windowDays:Number(value?.windowDays)||0};
 const students=await prisma.student.findMany({where:{active:true},select:{id:true,displayName:true,attendance:{select:{id:true,date:true,status:true},orderBy:{date:"asc"}}}});
 for(const student of students)await prisma.$transaction(async tx=>{
   await tx.student.update({where:{id:student.id},data:{updatedAt:new Date()}});
   const enquiries=await tx.safeguardingEnquiry.findMany({where:{studentId:student.id}});
   const consumed=new Set(enquiries.filter(e=>e.status!=="OPEN").flatMap(e=>e.absenceIds as string[]));
   const absences=qualifyingAbsences(student.attendance,consumed,policy,new Date());
   const open=enquiries.find(e=>e.status==="OPEN");
   if(absences.length>=3){const data={absenceIds:absences.map(a=>a.id),absenceDates:absences.map(a=>a.date.toISOString().slice(0,10))};if(open)await tx.safeguardingEnquiry.update({where:{id:open.id},data});else await tx.safeguardingEnquiry.upsert({where:{episodeKey:`${student.id}:${absences[0].id}`},update:{},create:{studentId:student.id,episodeKey:`${student.id}:${absences[0].id}`,...data}});}
 });
 return policy;
}
