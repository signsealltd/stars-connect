import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const KEY = "smtpConfiguration";
type Stored = {host:string;port:number;secure:boolean;username:string;passwordCipher?:string;fromName:string;fromEmail:string};

function encryptionKey() {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || "";
  if (secret.length < 32) throw new Error("SETTINGS_ENCRYPTION_KEY_REQUIRED");
  return createHash("sha256").update(secret).digest();
}
function encrypt(value:string) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv),encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(part=>part.toString("base64url")).join(".");
}
function decrypt(value?:string) {
  if(!value)return"";const[iv,tag,data]=value.split(".").map(part=>Buffer.from(part,"base64url"));
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),iv);decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
}
export async function loadSmtpEnv(){
  const row=await prisma.appSetting.findUnique({where:{key:KEY}});
  if(!row)return process.env;
  const value=row.value as Stored;
  return{...process.env,SMTP_HOST:value.host,SMTP_PORT:String(value.port),SMTP_SECURE:String(value.secure),SMTP_USERNAME:value.username,SMTP_PASSWORD:decrypt(value.passwordCipher),SMTP_FROM_NAME:value.fromName,SMTP_FROM_EMAIL:value.fromEmail};
}
export async function saveSmtpSettings(input:{host:string;port:number;secure:boolean;username:string;password?:string;clearCredentials?:boolean;fromName:string;fromEmail:string},userId:string){
  const current=await prisma.appSetting.findUnique({where:{key:KEY}}),previous=(current?.value||{})as Stored;
  const username=input.clearCredentials?"":input.username||previous.username||"";
  const passwordCipher=input.clearCredentials?undefined:input.password?encrypt(input.password):previous.passwordCipher;
  const value:Stored={host:input.host,port:input.port,secure:input.secure,username,passwordCipher,fromName:input.fromName,fromEmail:input.fromEmail};
  await prisma.appSetting.upsert({where:{key:KEY},update:{value,updatedBy:userId},create:{key:KEY,value,updatedBy:userId}});
  return{passwordChanged:Boolean(input.password),credentialsCleared:Boolean(input.clearCredentials)};
}

