import { randomBytes, randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sha256 } from "./security";
import { DEVICE_SETUP_CODE_TTL_MS } from "./devices";
type Tx=Prisma.TransactionClient;
export function newDeviceCredential(){return randomBytes(32).toString("base64url")}
export function placeholderCredentialHash(){return sha256(`unclaimed:${randomBytes(32).toString("base64url")}`)}
export function newSetupCode(){return randomInt(0,100_000_000).toString().padStart(8,"0")}
export async function issueSetupCode(deviceId:string,createdById:string,tx:Tx|typeof prisma=prisma){
 const now=new Date(),expiresAt=new Date(now.getTime()+DEVICE_SETUP_CODE_TTL_MS);
 await tx.deviceProvisioningCode.updateMany({where:{deviceId,consumedAt:null},data:{consumedAt:now}});
 for(let attempt=0;attempt<10;attempt++){
  const setupCode=newSetupCode(),codeHash=sha256(setupCode);
  if(await tx.deviceProvisioningCode.findUnique({where:{codeHash},select:{id:true}}))continue;
  await tx.deviceProvisioningCode.create({data:{deviceId,createdById,codeHash,expiresAt}});
  return{setupCode,expiresAt};
 }
 throw new Error("SETUP_CODE_GENERATION_FAILED");
}