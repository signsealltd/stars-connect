import {loadEnvConfig} from "@next/env";
import {readFile} from "node:fs/promises";
import {Prisma} from "@prisma/client";
loadEnvConfig(process.cwd());
async function main(){
 const {prisma}=await import("../src/lib/prisma");
 try{
  const file=process.argv.find(a=>a.startsWith("--backup="))?.slice(9);
  if(!file||!process.argv.includes("--apply"))throw new Error("Usage: npx tsx scripts/restore-training.ts --apply --backup=<private-backup.json>");
  const snapshot=JSON.parse(await readFile(file,"utf8"));
  if(snapshot.format!==1||!snapshot.tables?.TrainingIntegration?.[0]?.id)throw new Error("Unsupported training backup.");
  if(await prisma.organisation.count()>1)throw new Error("Shared multi-organisation catalogue restore is not supported.");
  const {withIhascoLock}=await import("../src/lib/ihasco-service");
  const integration=await prisma.trainingIntegration.findUniqueOrThrow({where:{id:snapshot.tables.TrainingIntegration[0].id}});
  await withIhascoLock(integration,async lease=>prisma.$transaction(async tx=>{
   await lease.fence(tx);
   await tx.trainingCourse.updateMany({data:{active:false}});
   await tx.staffTrainingRecord.updateMany({data:{active:false}});
   await tx.staffTrainingAssignment.deleteMany();
   await tx.trainingExternalResult.updateMany({where:{integrationId:integration.id},data:{trainingRecordId:null,qualifies:false}});
   await tx.trainingIntegrationCourse.deleteMany({where:{integrationId:integration.id}});
   await tx.trainingIntegrationUser.deleteMany({where:{integrationId:integration.id}});
   await tx.trainingCourseProvider.deleteMany();
   for(const model of ["TrainingProvider","TrainingCourse","StaffTrainingRecord","StaffTrainingAssignment","TrainingIntegrationUser","TrainingIntegrationCourse","TrainingExternalResult","TrainingCourseProvider"]){
    const metadata=Prisma.dmmf.datamodel.models.find(m=>m.name===model)!;
    for(const raw of snapshot.tables[model]||[]){
     const data=Object.fromEntries(Object.entries(raw).map(([key,value])=>{const field=metadata.fields.find(f=>f.name===key);return [key,field?.type==="DateTime"&&typeof value==="string"?new Date(value):field?.type==="Json"&&value===null?Prisma.DbNull:value];}));
     const delegate=tx[model[0].toLowerCase()+model.slice(1) as keyof typeof tx] as unknown as {upsert:(args:unknown)=>Promise<unknown>;create:(args:unknown)=>Promise<unknown>};
     if(data.id)await delegate.upsert({where:{id:data.id},create:data,update:data});else await delegate.create({data});
    }
   }
   // Files and their metadata are never deleted by rebuild. Leave sync paused for review.
   const original=snapshot.tables.TrainingIntegration[0];
   await tx.trainingIntegration.update({where:{id:integration.id},data:{syncPaused:true,rebuildVersion:null,certificatesEnabled:false,checkpoint:null,lastFullSyncAt:null,preview:Prisma.DbNull,previewToken:null,successCodes:original.successCodes??Prisma.DbNull}});
   await tx.auditLog.create({data:{action:"TRAINING_BACKUP_RESTORED",actorType:"SYSTEM",entityType:"TrainingIntegration",entityId:integration.id,afterValue:{backupVersion:snapshot.version}}});
  },{timeout:60000}));
  console.log("Training records and mappings restored. Certificate files and other modules were untouched. Training sync is paused for review.");
 }finally{await prisma.$disconnect();}
}
main().catch(()=>{console.error("Restore failed. Check the backup format and database availability. No credentials were logged.");process.exitCode=1;});
