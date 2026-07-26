import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sha256 } from "./security";
import { DEVICE_SETUP_CODE_TTL_MS } from "./devices";
type Tx=Prisma.TransactionClient;
export function newDeviceCredential(){return randomBytes(32).toString("base64url")}
export function placeholderCredentialHash(){return sha256(`unclaimed:${randomBytes(32).toString("base64url")}`)}
export async function issueSetupCode(deviceId:string,createdById:string,tx:Tx|typeof prisma=prisma){const now=new Date(),expiresAt=new Date(now.getTime()+DEVICE_SETUP_CODE_TTL_MS),setupCode=`SC-${randomBytes(24).toString("base64url")}`;await tx.deviceProvisioningCode.updateMany({where:{deviceId,consumedAt:null},data:{consumedAt:now}});await tx.deviceProvisioningCode.create({data:{deviceId,createdById,codeHash:sha256(setupCode),expiresAt}});return{setupCode,expiresAt}}