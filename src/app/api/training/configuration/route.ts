import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { starsTrainingFramework, trainingRoles } from "@/lib/training-matrix";

const rules = z.record(z.enum(trainingRoles), z.enum(["REQUIRED", "CONDITIONAL", "NOT_REQUIRED"]));
const providerSchema = z.object({ kind:z.literal("provider"), id:z.string().uuid().optional(), name:z.string().trim().min(2).max(191), contactName:z.string().trim().max(191).nullish(), email:z.string().trim().email().max(191).nullish().or(z.literal("")), phone:z.string().trim().max(40).nullish(), website:z.string().trim().url().max(500).nullish().or(z.literal("")), bookingNotes:z.string().trim().max(5000).nullish(), credentialsSummary:z.string().trim().max(5000).nullish(), accreditationBody:z.string().trim().max(191).nullish(), accreditationReference:z.string().trim().max(191).nullish(), accreditationExpiry:z.string().date().nullish().or(z.literal("")), evidenceReference:z.string().trim().max(500).nullish(), active:z.boolean().default(true) });
const courseSchema = z.object({ kind:z.literal("course"), id:z.string().uuid().optional(), name:z.string().trim().min(2).max(191), category:z.string().trim().min(2).max(100), description:z.string().trim().max(5000).nullish(), renewalMonths:z.number().int().min(1).max(120).nullish(), warningDays:z.number().int().min(1).max(365).default(60), requirementRules:rules, providerIds:z.array(z.string().uuid()).max(50).default([]), active:z.boolean().default(true) });

export async function GET(req:NextRequest){return withRole(req,"MANAGER",async()=>NextResponse.json({
  roles:trainingRoles,
  providers:await prisma.trainingProvider.findMany({where:{active:true},orderBy:{name:"asc"},include:{courses:{select:{courseId:true,preferred:true}}}}),
  courses:await prisma.trainingCourse.findMany({where:{active:true},orderBy:[{category:"asc"},{name:"asc"}],include:{providers:{include:{provider:{select:{id:true,name:true}}}}}}),
  frameworkAvailable:true,
}));}

export async function POST(req:NextRequest){return withRole(req,"MANAGER",async user=>{
  const body=await req.json().catch(()=>null);
  if(body?.action==="install-framework"){
    let created=0;
    for(const item of starsTrainingFramework){
      const exists=await prisma.trainingCourse.findUnique({where:{name:item.name},select:{id:true}});
      if(!exists){await prisma.trainingCourse.create({data:{...item,requirementRules:item.requirementRules,createdById:user.id,updatedById:user.id}});created++;}
    }
    await audit("TRAINING_FRAMEWORK_INSTALLED",{actorType:"USER",actorId:user.id,entityType:"TrainingCourse",afterValue:{created,total:starsTrainingFramework.length},...requestContext(req)});
    return NextResponse.json({created,total:starsTrainingFramework.length});
  }
  const parsed=z.union([providerSchema,courseSchema]).safeParse(body);if(!parsed.success)return jsonError("Check the training configuration details.",422);
  if(parsed.data.kind==="provider"){
    const {id,accreditationExpiry,...input}=parsed.data,data={...input,email:input.email||null,website:input.website||null,accreditationExpiry:accreditationExpiry?new Date(`${accreditationExpiry}T00:00:00Z`):null,updatedById:user.id};
    delete (input as {kind?:string}).kind;
    const row=id?await prisma.trainingProvider.update({where:{id},data}):await prisma.trainingProvider.create({data:{...data,createdById:user.id}});
    await audit(id?"TRAINING_PROVIDER_UPDATED":"TRAINING_PROVIDER_CREATED",{actorType:"USER",actorId:user.id,entityType:"TrainingProvider",entityId:row.id,afterValue:{name:row.name,accreditationExpiry:row.accreditationExpiry},...requestContext(req)});return NextResponse.json(row,{status:id?200:201});
  }
  const {id,providerIds,...input}=parsed.data;
  delete (input as {kind?:string}).kind;
  const row=await prisma.$transaction(async tx=>{const course=id?await tx.trainingCourse.update({where:{id},data:{...input,updatedById:user.id}}):await tx.trainingCourse.create({data:{...input,createdById:user.id,updatedById:user.id}});await tx.trainingCourseProvider.deleteMany({where:{courseId:course.id}});if(providerIds.length)await tx.trainingCourseProvider.createMany({data:providerIds.map((providerId,index)=>({courseId:course.id,providerId,preferred:index===0}))});return course;});
  await audit(id?"TRAINING_COURSE_UPDATED":"TRAINING_COURSE_CREATED",{actorType:"USER",actorId:user.id,entityType:"TrainingCourse",entityId:row.id,afterValue:{name:row.name,category:row.category,providerIds},...requestContext(req)});return NextResponse.json(row,{status:id?200:201});
});}
