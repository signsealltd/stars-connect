import{prisma}from"./prisma";
export async function audit(action:string,data:{actorType:string;actorId?:string;entityType?:string;entityId?:string;beforeValue?:object;afterValue?:object;deviceId?:string;ipAddress?:string}){try{await prisma.auditLog.create({data:{action,...data}})}catch(e){console.error("Audit write failed",e)}}
