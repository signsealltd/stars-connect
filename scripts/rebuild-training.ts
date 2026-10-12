import {loadEnvConfig} from "@next/env";
loadEnvConfig(process.cwd());
async function main(){
 const {prisma}=await import("../src/lib/prisma");
 try{
  const actorId=process.argv.find(a=>a.startsWith("--actor="))?.slice(8);
  if(!actorId||!process.argv.includes("--apply"))throw new Error("Usage: npx tsx scripts/rebuild-training.ts --apply --actor=<manager-login-email-or-user-id>");
  const organisationId=process.env.IHASCO_ORGANISATION_ID;
  if(!organisationId||!process.env.IHASCO_ACCOUNT_KEY)throw new Error("Set IHASCO_ORGANISATION_ID and IHASCO_ACCOUNT_KEY in the server environment. No changes were made.");
  const actor=await prisma.user.findFirst({where:{organisationId,OR:[{id:actorId},{email:actorId}]},select:{id:true}});
  if(!actor)throw new Error("No matching user exists in this organisation.");
  const {rebuildTraining}=await import("../src/lib/training-rebuild");
  const report=await rebuildTraining(actor.id,organisationId);
  console.log(JSON.stringify(report,null,2));if(report.blocker)process.exitCode=1;
 }finally{await prisma.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error&&!error.name.includes("Prisma")?error.message:"Training rebuild could not connect to the database or complete its transaction. No credentials were logged.");process.exitCode=1;});
