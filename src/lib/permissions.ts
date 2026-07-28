import type { Role, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { AccessError, getSession } from "./security";
export const CAPABILITIES = { PAYROLL_REVIEW:"payroll.review",PAYROLL_APPROVE:"payroll.approve",BILLING_REVIEW:"billing.review",BILLING_APPROVE:"billing.approve",DOCUMENT_DOWNLOAD:"document.download",DAILY_REPORT_VIEW:"daily-report.view",REPORT_SETTINGS_MANAGE:"report-settings.manage",VISITOR_CONTACT_VIEW:"visitor-contact.view",VISITOR_SIGNATURE_VIEW:"visitor-signature.view" } as const;
export type Capability=typeof CAPABILITIES[keyof typeof CAPABILITIES];
const grants:Record<Role,ReadonlySet<Capability>>={RECEPTION:new Set(),MANAGER:new Set([CAPABILITIES.PAYROLL_REVIEW,CAPABILITIES.BILLING_REVIEW,CAPABILITIES.DOCUMENT_DOWNLOAD,CAPABILITIES.DAILY_REPORT_VIEW,CAPABILITIES.VISITOR_CONTACT_VIEW]),DIRECTOR:new Set(Object.values(CAPABILITIES)),ADMINISTRATOR:new Set(Object.values(CAPABILITIES))};
export const capabilityOptions=[
  {key:CAPABILITIES.PAYROLL_REVIEW,label:"Review payroll",description:"View timesheets, corrections and payroll review data."},
  {key:CAPABILITIES.PAYROLL_APPROVE,label:"Approve payroll",description:"Approve, lock and generate payroll documents."},
  {key:CAPABILITIES.BILLING_REVIEW,label:"Review billing",description:"View billing profiles, charges and billing runs."},
  {key:CAPABILITIES.BILLING_APPROVE,label:"Manage billing",description:"Change billing profiles and approve or generate invoices."},
  {key:CAPABILITIES.DOCUMENT_DOWNLOAD,label:"Download documents",description:"Download protected reports, payroll files and invoices."},
  {key:CAPABILITIES.DAILY_REPORT_VIEW,label:"View daily reports",description:"View generated daily attendance reports."},
  {key:CAPABILITIES.REPORT_SETTINGS_MANAGE,label:"Manage reports and email",description:"Generate reports, configure delivery and manage email reporting."},
  {key:CAPABILITIES.VISITOR_CONTACT_VIEW,label:"View visitor contact details",description:"View protected visitor telephone and contact information."},
  {key:CAPABILITIES.VISITOR_SIGNATURE_VIEW,label:"View visitor signatures",description:"View retained visitor acceptance signatures."},
] as const;
function overrides(value:unknown):Partial<Record<Capability,boolean>>{if(!value||typeof value!=="object"||Array.isArray(value))return{};return value as Partial<Record<Capability,boolean>>}
export const hasCapability=(role:Role,capability:Capability,permissionOverrides?:unknown)=>overrides(permissionOverrides)[capability]??grants[role].has(capability);
export async function requireCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session)throw new AccessError(401,"AUTHENTICATION_REQUIRED");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))throw new AccessError(403,"FORBIDDEN");return session.user;}
export async function requirePageCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session||!session.user.active)redirect("/login");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))redirect(`/access-denied?from=${encodeURIComponent(capability)}`);return session.user;}
