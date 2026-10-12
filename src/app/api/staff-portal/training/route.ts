import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {withCapability} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {staffTrainingData} from "@/lib/staff-training-data";

export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_TRAINING,async user=>{
  const manager=hasCapability(user.role,CAPABILITIES.TRAINING_VIEW,user.permissionOverrides);
  const ids=manager?(await prisma.user.findMany({where:{organisationId:user.organisationId||""},select:{id:true}})).map(u=>u.id):[user.id];
  const staff=await prisma.staffMember.findMany({where:{userId:{in:ids}},select:{id:true,displayName:true,userId:true}});
  const rows=await Promise.all(staff.map(async person=>{
    const training=await staffTrainingData(person.id,user.organisationId||"");
    const documents=person.userId===user.id||hasCapability(user.role,CAPABILITIES.STAFF_HR_DOCUMENTS,user.permissionOverrides)?await prisma.staffPrivateDocument.findMany({where:{staffId:person.id,trainingRecordId:{in:training.map(t=>t.id)},expiresAt:{gt:new Date()}},select:{id:true,filename:true,trainingRecordId:true}}):[];
    return training.map(row=>({...row,staff:{displayName:person.displayName},documents:documents.filter(d=>d.trainingRecordId===row.id)}));
  }));
  return NextResponse.json(rows.flat(),{headers:{"Cache-Control":"private, no-store"}});
});}
