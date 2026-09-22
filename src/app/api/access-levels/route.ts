import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES} from "@/lib/permissions";
import {withCapability,jsonError} from "@/lib/api";
import {RequestError} from "@/lib/request-error";
import {audit} from "@/lib/audit";
import {STAFF_GRADES,STAFF_GRADE_ROLES} from "@/lib/staff-grades";
import {ensureStaffGrades} from "@/lib/staff-grade-access";
const schema=z.object({id:z.string().uuid().optional(),name:z.enum(STAFF_GRADES),baseRole:z.enum(["ADMINISTRATOR","TEAM_LEADER","CARE_ASSISTANT","MANAGER"]),permissions:z.record(z.enum(Object.values(CAPABILITIES) as [string,...string[]]),z.boolean()),active:z.boolean().default(true)});
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.USERS_MANAGE,async user=>{
  await prisma.$transaction(tx=>ensureStaffGrades(tx,user.id),{maxWait:10000,timeout:20000});
  const rows=await prisma.accessLevel.findMany({where:{name:{in:[...STAFF_GRADES]}}});return NextResponse.json(STAFF_GRADES.flatMap(name=>rows.filter(row=>row.name===name)));
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.USERS_MANAGE,async user=>{
  const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the level name and permissions.",422);
  const {id,...input}=p.data;
  input.baseRole=STAFF_GRADE_ROLES[input.name];
  if(id){const existing=await prisma.accessLevel.findUnique({where:{id}});if(existing?.name!==input.name)return jsonError("Staff grade names are fixed.",422);}
  if(input.name==="Administrator"&&user.role!=="ADMINISTRATOR")return jsonError("Only an administrator can edit administrator access.",403);
  if(input.name==="Administrator")input.active=true;
  const permissions=Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,input.name==="Administrator"?true:input.permissions[c]??false]));
  const row=await prisma.$transaction(async tx=>{
    const level=id?await tx.accessLevel.update({where:{id},data:{...input,permissions,updatedById:user.id}}):await tx.accessLevel.create({data:{...input,permissions,updatedById:user.id}});
    const users=await tx.user.findMany({where:{accessLevelId:level.id},select:{id:true}});
    if(users.some(u=>u.id===user.id)){
      if(user.role!=="ADMINISTRATOR")throw new RequestError("Ask another administrator to change your own assigned access level.",403);
      if(!input.active||!permissions[CAPABILITIES.USERS_MANAGE]||!permissions[CAPABILITIES.USERS_VIEW])throw new RequestError("Keep your Administrator level enabled with Users view and Users manage access so you can still manage the system.");
    }
    await tx.user.updateMany({where:{accessLevelId:level.id},data:{role:level.baseRole,permissionOverrides:permissions}});
    await tx.session.deleteMany({where:{userId:{in:users.filter(u=>u.id!==user.id).map(u=>u.id)}}});
    const staff=await tx.staffMember.findMany({where:{userId:{in:users.map(u=>u.id)}},select:{id:true}});await tx.staffPortalSession.deleteMany({where:{accountId:{in:staff.map(s=>s.id)}}});
    return level;
  },{maxWait:10000,timeout:20000});
  await audit("ACCESS_LEVEL_SAVED",{actorType:"USER",actorId:user.id,entityType:"AccessLevel",entityId:row.id,afterValue:{name:row.name,permissions}});
  return NextResponse.json(row);
});}
