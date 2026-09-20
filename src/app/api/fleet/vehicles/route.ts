import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withVehicle,canReviewFleet} from "@/lib/fleet-auth";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {vehicleConfigSchema,registrationKey,checklist} from "@/lib/vehicle-checklist";
import {returnVehicle} from "@/lib/fleet-service";
const date=z.string().date().nullable().optional();
const schema=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(120),registration:z.string().trim().min(2).max(30),make:z.string().trim().max(80).default(""),model:z.string().trim().max(80).default(""),vehicleType:z.string().max(80).default("Minibus"),fuelType:z.enum(["DIESEL","PETROL","HYBRID","ELECTRIC","OTHER"]),mileage:z.number().int().min(0).max(9999999),config:vehicleConfigSchema,notes:z.string().max(5000).default(""),motExpiry:date,taxExpiry:date,insuranceExpiry:date,serviceDue:date,serviceMileage:z.number().int().min(0).nullable().optional(),reason:z.string().trim().min(3).max(2000)});
export async function GET(req:NextRequest){return withVehicle(req,async user=>{
 const manager=await canReviewFleet(),today=new Date(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London"}).format(new Date()));
 const rows=await prisma.fleetVehicle.findMany({where:manager?{}:{status:{not:"ARCHIVED"}},include:{checks:{where:{checkDate:today},select:{id:true,outcome:true,submittedAt:true},orderBy:{submittedAt:"desc"}},_count:{select:{defects:{where:{status:{not:"CLOSED"}}}}}},orderBy:{name:"asc"}});
 return NextResponse.json({user:{id:user.id,name:user.name},manager,rows},{headers:{"cache-control":"private, no-store"}});
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async user=>{
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the vehicle details and enter a change reason.",422);
 const {id,reason,...d}=parsed.data,key=registrationKey(d.registration);if(!key)return jsonError("Enter a registration number.",422);
 const keys=checklist(d.fuelType,d.config).flatMap(s=>s.items.map(i=>i.key));if(d.config.stopUse.some(k=>!keys.includes(k)))return jsonError("Unknown stop-use check.",422);
 try{const row=await prisma.$transaction(async tx=>{const before=id?await tx.fleetVehicle.update({where:{id},data:{updatedAt:new Date()}}):null;
 const data={...d,registration:d.registration.toUpperCase(),registrationKey:key,motExpiry:d.motExpiry?new Date(d.motExpiry):null,taxExpiry:d.taxExpiry?new Date(d.taxExpiry):null,insuranceExpiry:d.insuranceExpiry?new Date(d.insuranceExpiry):null,serviceDue:d.serviceDue?new Date(d.serviceDue):null,updatedById:user.id};
 const saved=id?await tx.fleetVehicle.update({where:{id},data}):await tx.fleetVehicle.create({data:{...data,createdById:user.id}});
 await tx.auditLog.create({data:{action:"FLEET_VEHICLE_SAVED",actorType:"USER",actorId:user.id,entityType:"FleetVehicle",entityId:saved.id,beforeValue:before?JSON.parse(JSON.stringify(before)):undefined,afterValue:JSON.parse(JSON.stringify({vehicle:saved,reason}))}});return saved;});return NextResponse.json(row);}catch{return jsonError("Unable to save. Check the registration is unique and the record still exists.",409);}
});}
export async function PATCH(req:NextRequest){const body=await req.json().catch(()=>null);if(!z.string().uuid().safeParse(body?.id).success||typeof body?.notes!=="string"||body.notes.trim().length<3||body.notes.length>2000)return jsonError("Enter a reason.",422);
 return withCapability(req,body.action==="return"?CAPABILITIES.FLEET_RETURN:CAPABILITIES.FLEET_MANAGE,async user=>{try{
 if(body.action==="return")return NextResponse.json(await returnVehicle(body.id,body.notes,user.id));
 if(!["archive","reactivate","stop"].includes(body.action))return jsonError("Unknown vehicle action.",422);
 await prisma.$transaction(async tx=>{const before=await tx.fleetVehicle.update({where:{id:body.id},data:{updatedAt:new Date()}});if(body.action==="reactivate"&&before.status!=="ARCHIVED")throw Error("Vehicle is not archived.");const status=body.action==="archive"?"ARCHIVED":"OUT_OF_SERVICE";await tx.fleetVehicle.update({where:{id:body.id},data:{status,updatedById:user.id}});await tx.auditLog.create({data:{action:"FLEET_STATUS_CHANGED",actorType:"USER",actorId:user.id,entityType:"FleetVehicle",entityId:body.id,beforeValue:{status:before.status},afterValue:{status,notes:body.notes}}});});return NextResponse.json({ok:true});
 }catch(e){return jsonError(e instanceof Error?e.message:"Unable to update vehicle.",409);}});
}
