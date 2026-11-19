import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {generateKeyPairSync,randomBytes,createCipheriv,privateDecrypt,constants,createDecipheriv,createHash} from "crypto";
import {prisma} from "./prisma";
import {getSession,sha256} from "./security";
import {mutationOriginAllowed} from "./api";
import {staffSession} from "./staff-area-auth";

export const MYDAY_COOKIE="stars_myday";
export class MyDayError extends Error {constructor(message:string,public status=400){super(message)}}
export const mydayJson=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"cache-control":"private, no-store, max-age=0","vary":"Cookie"}});
export async function mydayEnabled(){return process.env.MYDAY_DISABLED!=="true"&&(await prisma.appSetting.findUnique({where:{key:"mydayEnabled"}}))?.value!==false;}
export async function mydayOrganisation(){const rows=await prisma.organisation.findMany({select:{id:true},take:2});if(rows.length!==1)throw new MyDayError("My Day requires an unambiguous client service. Ask an administrator to configure service access.",503);return rows[0].id;}
export type MyDayActor={id:string;name:string;organisationId:string;admin:boolean;staffId?:string};
export async function staffStillAllowed(staffId:string,credentialId?:string,credentialHash?:string){
 const staff=await prisma.staffMember.findFirst({where:{id:staffId,active:true,archivedAt:null,OR:[{endDate:null},{endDate:{gte:new Date()}}]}});if(!staff)return null;
 if(credentialId&&!await prisma.staffCredential.findFirst({where:{id:credentialId,staffId,active:true,kind:"PIN",valueHash:credentialHash}}))return null;
 if(staff.userId){const user=await prisma.user.findUnique({where:{id:staff.userId}});if(!user?.active)return null;if(user.accessLevelId){const level=await prisma.accessLevel.findUnique({where:{id:user.accessLevelId}});if(!level?.active)return null;}}
 if(staff.accessLevelId){const level=await prisma.accessLevel.findUnique({where:{id:staff.accessLevelId}});if(!level?.active)return null;}
 return staff;
}
export async function mydayActor():Promise<MyDayActor|null>{
 const organisationId=await mydayOrganisation();
 const token=(await cookies()).get(MYDAY_COOKIE)?.value;
 if(token){const session=await prisma.myDaySession.findUnique({where:{tokenHash:sha256(token)}});if(session&&session.organisationId===organisationId&&session.expiresAt>new Date()&&session.lastSeenAt.getTime()>Date.now()-15*60_000){const staff=await staffStillAllowed(session.staffId,session.credentialId,session.credentialHash);if(staff){await prisma.myDaySession.update({where:{id:session.id},data:{lastSeenAt:new Date()}});return {id:staff.id,staffId:staff.id,name:staff.displayName,organisationId,admin:false};}}return null;}
 const session=await getSession();
 if(session?.user.organisationId===organisationId){const user=session.user;const staff=await prisma.staffMember.findFirst({where:{userId:user.id,active:true,archivedAt:null}});const admin=["MANAGER","DIRECTOR","ADMINISTRATOR"].includes(user.role);if(admin||staff)return {id:staff?.id||user.id,staffId:staff?.id,name:staff?.displayName||user.name,organisationId,admin};}
 const portal=await staffSession();if(portal?.user.organisationId===organisationId)return {id:portal.staff.id,staffId:portal.staff.id,name:portal.staff.displayName,organisationId,admin:false};
 return null;
}
export async function withMyday(req:NextRequest,handler:(actor:MyDayActor)=>Promise<NextResponse>,admin=false){
 try{if(!mutationOriginAllowed(req))throw new MyDayError("Request origin rejected.",403);if(!await mydayEnabled())throw new MyDayError("My Day is currently switched off.",404);const actor=await mydayActor();if(!actor)throw new MyDayError("Enter your staff PIN to open My Day.",401);if(admin&&!actor.admin)throw new MyDayError("Manager access required.",403);return await handler(actor);}catch(e){if(e instanceof MyDayError)return mydayJson({error:e.message},e.status);if(e&&typeof e==="object"&&"code" in e&&["P2034","P2002"].includes(String(e.code)))return mydayJson({error:"Another save is completing. Reload before editing, or retry your queued update."},409);console.error("My Day request failed",e instanceof Error?e.name:"unknown");return mydayJson({error:"My Day could not complete this request. Your saved entries are safe. Please retry."},500);}
}
export async function requireMydayClient(studentId:string,allowHidden=false){const student=await prisma.student.findFirst({where:{id:studentId,archivedAt:null}});if(!student)throw new MyDayError("Client unavailable.",404);if(!allowHidden){const visibility=await prisma.myDayClient.findUnique({where:{studentId}});if(visibility?.hidden||!student.active)throw new MyDayError("This client is hidden from My Day. New updates are unavailable.",403);}return student;}
function settingsKey(){const secret=process.env.SETTINGS_ENCRYPTION_KEY||"";if(secret.length<32)throw new MyDayError("Protected offline storage is not configured. Ask an administrator to check SETTINGS_ENCRYPTION_KEY.",503);return createHash("sha256").update(secret).digest();}
function openKeys(value:unknown){const stored=value as {publicKey:JsonWebKey;privateKeyCipher:string},[iv,tag,bytes]=stored.privateKeyCipher.split(".").map(s=>Buffer.from(s,"base64url")),decipher=createDecipheriv("aes-256-gcm",settingsKey(),iv);decipher.setAuthTag(tag);return {publicKey:stored.publicKey,privateKey:Buffer.concat([decipher.update(bytes),decipher.final()]).toString("utf8")};}
export async function mydayKeys(){
 const existing=await prisma.appSetting.findUnique({where:{key:"mydayQueueEncryption"}});if(existing)return openKeys(existing.value);
 const key=settingsKey(),pair=generateKeyPairSync("rsa",{modulusLength:3072,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
 const {createPublicKey}=await import("crypto");const publicKey=createPublicKey(pair.publicKey).export({format:"jwk"}),iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),bytes=Buffer.concat([cipher.update(pair.privateKey,"utf8"),cipher.final()]),privateKeyCipher=[iv,cipher.getAuthTag(),bytes].map(b=>b.toString("base64url")).join(".");
 const row=await prisma.appSetting.upsert({where:{key:"mydayQueueEncryption"},update:{},create:{key:"mydayQueueEncryption",value:JSON.parse(JSON.stringify({publicKey,privateKeyCipher})),updatedBy:"myday-system"}});
 return openKeys(row.value);
}
export async function issueMydayGrant(actor:MyDayActor,credentialId?:string,credentialHash?:string){
 if(!actor.staffId||!credentialId||!credentialHash)return null;
 const secret=randomBytes(32).toString("base64url"),grant=await prisma.myDayGrant.create({data:{staffId:actor.staffId,organisationId:actor.organisationId,credentialId,credentialHash,secretHash:sha256(secret),expiresAt:new Date(Date.now()+7*86400_000)}});
 return {id:grant.id,secret,expiresAt:grant.expiresAt.toISOString(),publicKey:(await mydayKeys()).publicKey};
}
export async function decryptMydayEnvelope(envelope:{key:string;iv:string;ciphertext:string}){
 if(envelope.ciphertext.length>100_000)throw new MyDayError("Queued entry is too large.",422);
 try{const key=privateDecrypt({key:(await mydayKeys()).privateKey,oaepHash:"sha256",padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.key,"base64")),data=Buffer.from(envelope.ciphertext,"base64");const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.iv,"base64"));decipher.setAuthTag(data.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(data.subarray(0,-16)),decipher.final()]).toString("utf8"));}catch{throw new MyDayError("The protected queued entry could not be verified.",422);}
}
export const mydaySourceHash=(rows:unknown)=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");
