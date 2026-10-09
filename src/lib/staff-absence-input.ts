import {staffAbsenceTypes} from "@/lib/staff-absence-types";
import {z} from "zod";
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();
export const absenceFields={staffId:z.string().uuid(),type:z.enum([...staffAbsenceTypes]),startDate:z.string().date(),endDate:z.string().date(),startTime:time,endTime:time,notes:z.string().trim().max(2000).optional(),bradfordExcluded:z.boolean().default(false),bradfordReason:z.string().trim().max(500).default("")};
export const absenceCreateInput=z.object(absenceFields).superRefine((v,c)=>{
  if(v.endDate<v.startDate||Date.parse(v.endDate)-Date.parse(v.startDate)>366*86400000)c.addIssue({code:"custom",message:"Choose an absence of up to one year."});
  if(Boolean(v.startTime)!==Boolean(v.endTime)||(v.startTime&&v.endTime&&v.endTime<=v.startTime))c.addIssue({code:"custom",message:"Choose both times, with the end after the start."});
  if(v.bradfordExcluded&&(v.type!=="SICKNESS"||!v.bradfordReason))c.addIssue({code:"custom",message:"A reason is required to exclude sickness from Bradford scoring."});
});
export const absenceEditInput=z.object({id:z.string().uuid(),updatedAt:z.string().datetime(),reason:z.string().trim().min(1).max(2000),values:absenceCreateInput});
export const absenceCancelInput=z.object({id:z.string().uuid(),updatedAt:z.string().datetime(),reason:z.string().trim().min(1).max(2000)});
