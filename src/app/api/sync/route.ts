import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type AttendanceStatus, type ClockEventType, type PhotoStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";

const eventSchema=z.object({id:z.uuid(),operation:z.enum(["CLOCK_EVENT","ATTENDANCE","ROLL_CALL_ENTRY"]),payload:z.record(z.string(),z.unknown()),createdAt:z.string(),attempts:z.number()});
const bodySchema=z.object({cursor:z.string().regex(/^\d+$/),events:z.array(eventSchema).max(250)});

async function authorise(req:NextRequest){
 const id=req.headers.get("x-device-id"),token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!id||!token)return null;
 if(id==="development-device"&&token==="development-token"&&process.env.NODE_ENV!=="production")return{id};
 return prisma.device.findFirst({where:{id,tokenHash:sha256(token),status:"ACTIVE"}});
}

export async function POST(req:NextRequest){
 const device=await authorise(req);
 if(!device)return NextResponse.json({error:"Device not authorised"},{status:401});
 const parsed=bodySchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid sync payload",details:parsed.error.flatten()},{status:400});
 const acknowledged:string[]=[];
 for(const item of parsed.data.events){
  if(await prisma.syncEvent.findUnique({where:{eventId:item.id}})){acknowledged.push(item.id);continue}
  try{
   await prisma.$transaction(async tx=>{
    const p=item.payload;
    if(item.operation==="CLOCK_EVENT"){
     const timestamp=new Date(String(p.deviceTimestamp));
     const duplicate=await tx.clockEvent.findFirst({where:{staffId:String(p.staffId),type:String(p.type) as ClockEventType,deviceTimestamp:{gte:new Date(timestamp.getTime()-20_000),lte:new Date(timestamp.getTime()+20_000)}}});
     if(duplicate)await tx.syncConflict.create({data:{entityType:"ClockEvent",entityId:item.id,deviceId:device.id,serverValue:JSON.parse(JSON.stringify(duplicate)),incomingValue:p as Prisma.InputJsonValue}});
     else await tx.clockEvent.create({data:{id:item.id,staffId:String(p.staffId),deviceId:device.id,type:String(p.type) as ClockEventType,deviceTimestamp:timestamp,offlineRecorded:Boolean(p.offlineRecorded),photoStatus:String(p.photoStatus||"NOT_REQUIRED") as PhotoStatus}});
    }
    if(item.operation==="ATTENDANCE"){
     const date=new Date(String(p.date));
     const current=await tx.studentAttendance.findUnique({where:{studentId_date:{studentId:String(p.studentId),date}}});
     if(current&&Number(p.version)<=current.version)await tx.syncConflict.create({data:{entityType:"StudentAttendance",entityId:item.id,deviceId:device.id,serverValue:JSON.parse(JSON.stringify(current)),incomingValue:p as Prisma.InputJsonValue}});
     else await tx.studentAttendance.upsert({where:{studentId_date:{studentId:String(p.studentId),date}},create:{id:item.id,studentId:String(p.studentId),deviceId:device.id,date,status:String(p.status) as AttendanceStatus,arrivalTime:p.arrivalTime?new Date(String(p.arrivalTime)):null,departureTime:p.departureTime?new Date(String(p.departureTime)):null,note:p.note?String(p.note):null,deviceTimestamp:new Date(String(p.deviceTimestamp)),version:Number(p.version)},update:{deviceId:device.id,status:String(p.status) as AttendanceStatus,arrivalTime:p.arrivalTime?new Date(String(p.arrivalTime)):null,departureTime:p.departureTime?new Date(String(p.departureTime)):null,note:p.note?String(p.note):null,deviceTimestamp:new Date(String(p.deviceTimestamp)),version:Number(p.version)}});
    }
    await tx.syncEvent.create({data:{eventId:item.id,deviceId:device.id,operation:item.operation,payload:p as Prisma.InputJsonValue}});
   });
   acknowledged.push(item.id);
   await audit("SYNC_EVENT_ACCEPTED",{actorType:"DEVICE",deviceId:device.id,entityType:item.operation,entityId:item.id});
  }catch(error){console.error("Sync event failed",item.id,error)}
 }
 const after=BigInt(parsed.data.cursor);
 const updates=await prisma.syncEvent.findMany({where:{sequence:{gt:after}},orderBy:{sequence:"asc"},take:500});
 const cursor=updates.at(-1)?.sequence??after;
 return NextResponse.json({acknowledged,cursor:String(cursor),events:updates.map(x=>({...x,sequence:String(x.sequence)}))});
}
