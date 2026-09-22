import {z} from "zod";
export const portalPin=z.string().regex(/^\d{4,8}$/, "Enter your existing clocking PIN.");
export const profileChangeInput=z.object({firstName:z.string().trim().min(1).max(80).optional(),lastName:z.string().trim().min(1).max(80).optional(),email:z.string().email().max(191).optional(),jobRole:z.string().trim().min(1).max(100).optional(),contractedWeeklyHours:z.number().min(0).max(168).optional()});
export const requestInput=z.object({
  key:z.string().uuid(),type:z.enum(["LEAVE","SICKNESS","CONCERN","PROFILE"]),
  startDate:z.string().date().optional(),endDate:z.string().date().optional(),
  startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  proposed:profileChangeInput.optional(),
  category:z.string().trim().max(100).default(""),description:z.string().trim().max(6000).default(""),
  confidential:z.boolean().default(false),involvedUserIds:z.array(z.string().uuid()).max(50).default([]),
  peopleInvolved:z.string().max(1000).default(""),location:z.string().max(191).default(""),
  immediateRisk:z.boolean().default(false),contactPreference:z.string().max(191).default(""),
  ongoing:z.boolean().default(false),workRelated:z.boolean().default(false),supportRequested:z.boolean().default(false),
  declaration:z.boolean().default(false),selfCertification:z.string().max(6000).default(""),draft:z.boolean().default(false),
}).superRefine((v,c)=>{
 if(["LEAVE","SICKNESS"].includes(v.type)&&(!v.startDate||!v.endDate||v.endDate<v.startDate||Date.parse(v.endDate)-Date.parse(v.startDate)>366*86400000))c.addIssue({code:"custom",message:"Choose valid dates within one year."});
 if(Boolean(v.startTime)!==Boolean(v.endTime)||(v.startTime&&v.endTime&&v.endTime<=v.startTime))c.addIssue({code:"custom",message:"Choose both partial-day times in order."});
 if(v.type==="CONCERN"&&(!v.description||!v.declaration))c.addIssue({code:"custom",message:"Describe the concern and confirm your declaration."});
 if(v.selfCertification&&!v.draft&&!v.declaration)c.addIssue({code:"custom",message:"Confirm the self-certification declaration."});
});
export function requestReviewAllowed(type:string,capabilities:string[],userId:string,involved:string[]){
 if(type==="CONCERN")return capabilities.includes("staff-concerns.review")&&!involved.includes(userId);
 return capabilities.includes(type==="SICKNESS"?"staff-sickness.review":type==="LEAVE"?"staff-leave.approve":"staff-profile.approve");
}
export function staffDateRange(month:string){if(!/^\d{4}-\d{2}$/.test(month))throw Error("Invalid month");const start=new Date(month+"-01T00:00:00Z");if(!Number.isFinite(+start)||start.toISOString().slice(0,7)!==month)throw Error("Invalid month");return {start,end:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))};}
