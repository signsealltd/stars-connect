import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, requestContext } from "@/lib/api";
import { sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";

async function authorisedDevice(req:NextRequest){
 const id=req.headers.get("x-device-id"),token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!id||!token)return null;
 return prisma.device.findFirst({where:{id,tokenHash:sha256(token),status:"ACTIVE",isSeedData:false},select:{id:true,lastSyncAt:true,syncRequestedAt:true}});
}
export async function GET(req:NextRequest){
 const device=await authorisedDevice(req);
 if(!device)return NextResponse.json({error:"Device credential rejected."},{status:401});
 return NextResponse.json({requested:Boolean(device.syncRequestedAt&&(!device.lastSyncAt||device.syncRequestedAt>device.lastSyncAt))},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
export async function POST(req:NextRequest){
 return withRole(req,"RECEPTION",async user=>{
  const requestedAt=new Date();
  const result=await prisma.device.updateMany({where:{status:"ACTIVE",isSeedData:false},data:{syncRequestedAt:requestedAt}});
  await audit("DEVICE_SYNC_REQUESTED",{actorType:"USER",actorId:user.id,entityType:"Device",afterValue:{deviceCount:result.count,requestedAt:requestedAt.toISOString()},...requestContext(req)});
  return NextResponse.json({requestedAt,deviceCount:result.count});
 });
}