import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {withCapability,jsonError} from "@/lib/api";
import {audit} from "@/lib/audit";
const schema=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(2).max(100),baseRole:z.enum(["TEAM_LEADER","CARE_ASSISTANT","RECEPTION","MANAGER","DIRECTOR"]),permissions:z.record(z.enum(Object.values(CAPABILITIES) as [string,...string[]]),z.boolean()),active:z.boolean().default(true)});
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.USERS_MANAGE,async user=>{
  for(const [name,baseRole] of [["Team Leader","TEAM_LEADER"],["Care Assistant","CARE_ASSISTANT"]] as const)await prisma.accessLevel.upsert({where:{name},update:{},create:{name,baseRole,permissions:Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,hasCapability(baseRole,c)])),updatedById:user.id}});
  return NextResponse.json(await prisma.accessLevel.findMany({orderBy:{name:"asc"}}));
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.USERS_MANAGE,async user=>{
  const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the level name and permissions.",422);
  const {id,...input}=p.data;
  const permissions=Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,input.permissions[c]??false]));
  const row=await prisma.$transaction(async tx=>{
    const level=id?await tx.accessLevel.update({where:{id},data:{...input,permissions,updatedById:user.id}}):await tx.accessLevel.create({data:{...input,permissions,updatedById:user.id}});
    const users=await tx.user.findMany({where:{accessLevelId:level.id},select:{id:true}});
    if(users.some(u=>u.id===user.id))throw new Error("Use another administrator to change your own assigned level.");
    await tx.user.updateMany({where:{accessLevelId:level.id},data:{role:level.baseRole,permissionOverrides:permissions}});
    await tx.session.deleteMany({where:{userId:{in:users.map(u=>u.id)}}});
    return level;
  });
  await audit("ACCESS_LEVEL_SAVED",{actorType:"USER",actorId:user.id,entityType:"AccessLevel",entityId:row.id,afterValue:{name:row.name,permissions}});
  return NextResponse.json(row);
});}
