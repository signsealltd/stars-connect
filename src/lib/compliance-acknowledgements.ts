import {prisma} from './prisma';
import type {Prisma} from '@prisma/client';
type Version={id:string;status:string;structuredContent:unknown;acknowledgements:{userId:string;acknowledgedAt:Date}[]};
/** Include retained receipts and explicit publication recipients even after a role or employment change. */
export async function acknowledgementAudience(organisationId:string,versions:Version[],db:Prisma.TransactionClient=prisma){
 const assignments=await db.complianceAssignment.findMany({where:{organisationId,versionId:{in:versions.map(v=>v.id)}}});
 const users=await db.user.findMany({where:{organisationId},select:{id:true,name:true,active:true}});
 const people=await db.staffMember.findMany({where:{userId:{in:users.map(u=>u.id)}},select:{id:true,userId:true,displayName:true,jobRole:true,active:true,archivedAt:true}});
 return Object.fromEntries(versions.map(v=>{const assigned=assignments.filter(a=>a.versionId===v.id);const rows=users.flatMap(u=>{const person=people.find(p=>p.userId===u.id);const receipt=v.acknowledgements.find(a=>a.userId===u.id);const explicit=assigned.some(a=>a.userId===u.id);const group=person&&person.active&&!person.archivedAt&&u.active&&assigned.some(a=>a.allStaff||a.staffRole===person.jobRole);return receipt||explicit||group?[{userId:u.id,staff:person?.displayName||u.name,acknowledgedAt:receipt?.acknowledgedAt||null}]:[]});return [v.id,{required:(v.structuredContent as Record<string,unknown>)?.acknowledgementRequired!==false,expected:rows.length,acknowledged:rows.filter(r=>r.acknowledgedAt).length,rows}]}));
}
