import {checkCanBeAmended} from "./vehicle-day";
import {Prisma} from "@prisma/client";
import {createHash} from "crypto";
import {prisma} from "./prisma";
import {validateCheck,CHECKLIST_VERSION,DECLARATION,validTransition,type Submission} from "./vehicle-checklist";
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function fleetTransaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 for(let attempt=0;;attempt++){
  try{return await prisma.$transaction(work,{timeout:30000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});}
  catch(error){
   const message=error instanceof Error?error.message:"";
   const retryable=(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")||/Record has changed since last read|Deadlock found|Lock wait timeout exceeded/.test(message);
   if(!retryable||attempt>=3)throw error;
   await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
  }
 }
}
export async function submitVehicleCheck(input:Submission,user:{id:string;name:string}){
 const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
 return fleetTransaction(async tx=>{
  // All submissions and manager status actions acquire the same per-vehicle row lock.
  await tx.fleetVehicle.update({where:{id:input.vehicleId},data:{updatedAt:new Date()}});
  const duplicate=await tx.vehicleCheck.findUnique({where:{id:input.id}});
  if(duplicate){if(duplicate.userId!==user.id||duplicate.payloadHash!==hash)throw Error("This submission ID already belongs to a different check.");return duplicate;}
  const previous=input.amendmentOf?await tx.vehicleCheck.findUnique({where:{id:input.amendmentOf}}):null;
  if(input.amendmentOf){if(!previous)throw Error("Original check not found.");checkCanBeAmended(previous,input,user.id);if(await tx.vehicleCheck.findUnique({where:{supersedesId:previous.id}}))throw Error("This check has already been amended. Reload the latest version before editing.");}
  const original=previous?.snapshot as {initialImageId:string;answers:Submission["answers"]}|undefined;
  const vehicle=await tx.fleetVehicle.findUniqueOrThrow({where:{id:input.vehicleId}});
  const result=validateCheck(input,previous?{...vehicle,mileage:Math.min(previous.mileage,vehicle.mileage)}:vehicle);
  const imageIds=[input.initialImageId,...result.answers.flatMap(a=>a.response==="DEFECT"?a.imageIds:[])];
  const unique=[...new Set(imageIds)];
  const images=await tx.documentRecord.findMany({where:{id:{in:unique},sourceType:"VEHICLE_EVIDENCE",createdById:user.id,OR:[{sourceId:input.id},...(original?[{id:{in:[original.initialImageId,...original.answers.flatMap(a=>a.imageIds)]}}]:[])]}});
  if(images.length!==unique.length)throw Error("Upload every required photograph before submitting.");
  const checkDate=new Date(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London"}).format(new Date(input.clientStartedAt)));
  const row=await tx.vehicleCheck.create({data:{id:input.id,supersedesId:previous?.id,rootCheckId:previous?(previous.rootCheckId||previous.id):undefined,revision:previous?previous.revision+1:1,vehicleId:vehicle.id,userId:user.id,staffName:user.name,checkDate,clientStartedAt:new Date(input.clientStartedAt),mileage:input.mileage,outcome:result.outcome,checklistVersion:CHECKLIST_VERSION,declarationVersion:"1",payloadHash:hash,snapshot:json({vehicle:{name:vehicle.name,registration:vehicle.registration,fuelType:vehicle.fuelType,config:vehicle.config},answers:result.answers,initialImageId:input.initialImageId,declaration:DECLARATION})}});
  await tx.fleetVehicle.update({where:{id:vehicle.id},data:{mileage:Math.max(vehicle.mileage,input.mileage),...(result.outcome==="UNSAFE"?{status:"OUT_OF_SERVICE"}:{})}});
  for(const a of result.answers.filter(a=>a.response==="DEFECT")){
   const old=original?.answers.find(answer=>answer.key===a.key);
   if(old?.response==="DEFECT"&&old.severity===a.severity&&old.notes===a.notes&&JSON.stringify(old.imageIds)===JSON.stringify(a.imageIds)&&old.secured===a.secured)continue;
   const defect=await tx.vehicleDefect.create({data:{vehicleId:vehicle.id,checkId:row.id,itemKey:a.key,description:a.notes,severity:a.severity!,events:{create:{toStatus:"REPORTED",userId:user.id,notes:a.notes,details:json({images:a.imageIds,secured:a.secured,label:a.label})}}}});
   await tx.auditLog.create({data:{action:"VEHICLE_DEFECT_REPORTED",actorType:"USER",actorId:user.id,entityType:"VehicleDefect",entityId:defect.id,afterValue:json({severity:a.severity,vehicleId:vehicle.id,checkId:row.id})}});
  }
  if(result.outcome==="UNSAFE")await tx.operationalTask.upsert({where:{sourceKey:`vehicle-unsafe:${row.rootCheckId||row.id}`},update:{},create:{sourceKey:`vehicle-unsafe:${row.rootCheckId||row.id}`,title:`DO NOT USE: ${vehicle.name} ${vehicle.registration}`.slice(0,191),startDate:checkDate,endDate:checkDate,dueDate:checkDate,notes:"Safety-critical vehicle report. Review Safety & Compliance → Fleet before returning this vehicle to service.",createdById:user.id}});
  await tx.auditLog.create({data:{action:previous?"VEHICLE_CHECK_AMENDED":"VEHICLE_CHECK_SUBMITTED",actorType:"USER",actorId:user.id,entityType:"VehicleCheck",entityId:row.id,afterValue:json({outcome:row.outcome,vehicleId:vehicle.id,supersedesId:previous?.id,revision:row.revision})}});
  return row;
 });
}
export async function transitionDefect(id:string,to:string,notes:string,details:Record<string,unknown>,userId:string){
 return fleetTransaction(async tx=>{
  const initial=await tx.vehicleDefect.findUniqueOrThrow({where:{id}});
  await tx.fleetVehicle.update({where:{id:initial.vehicleId},data:{updatedAt:new Date()}});
  const before=await tx.vehicleDefect.findUniqueOrThrow({where:{id}});
  if(!validTransition(before.status,to,notes))throw Error("Invalid transition. Review the current status and enter a reason.");
  if(to==="REPAIRED"&&!details.repairDate)throw Error("Record the repair date.");
  if(to==="VERIFIED"&&!String(details.verification||"").trim())throw Error("Record how the repair or no-fault finding was verified.");
  if(details.documentId&&!await tx.documentRecord.findFirst({where:{id:String(details.documentId),sourceType:"FLEET_DOCUMENT",sourceId:before.vehicleId}}))throw Error("Choose supporting evidence attached to this vehicle.");
  const row=await tx.vehicleDefect.update({where:{id},data:{status:to}});
  await tx.vehicleDefectEvent.create({data:{defectId:id,fromStatus:before.status,toStatus:to,userId,notes,details:json(details)}});
  await tx.auditLog.create({data:{action:"VEHICLE_DEFECT_TRANSITION",actorType:"USER",actorId:userId,entityType:"VehicleDefect",entityId:id,beforeValue:{status:before.status},afterValue:json({status:to,notes,details})}});
  return row;
 });
}
export async function returnVehicle(id:string,notes:string,userId:string){
 if(!notes.trim())throw Error("Record the return-to-service verification.");
 return fleetTransaction(async tx=>{
  const vehicle=await tx.fleetVehicle.update({where:{id},data:{updatedAt:new Date()}});
  if(vehicle.status==="ARCHIVED")throw Error("Reactivate the archived vehicle first.");
  const open=await tx.vehicleDefect.findMany({where:{vehicleId:id,status:{not:"CLOSED"}}});
  if(open.some(d=>d.status!=="VERIFIED"))throw Error("Every open defect must be verified before returning this vehicle to service.");
  for(const d of open){await tx.vehicleDefect.update({where:{id:d.id},data:{status:"CLOSED"}});await tx.vehicleDefectEvent.create({data:{defectId:d.id,fromStatus:"VERIFIED",toStatus:"CLOSED",userId,notes,details:{returnedToService:true}}});}
  await tx.fleetVehicle.update({where:{id},data:{status:"ACTIVE",updatedById:userId}});
  await tx.auditLog.create({data:{action:"VEHICLE_RETURNED_TO_SERVICE",actorType:"USER",actorId:userId,entityType:"FleetVehicle",entityId:id,afterValue:{notes,closedDefects:open.map(d=>d.id)}}});
  return {ok:true};
 });
}
