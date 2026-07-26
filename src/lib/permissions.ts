import type { Role, User } from "@prisma/client";
import { getSession } from "./security";
export const CAPABILITIES = { PAYROLL_REVIEW:"payroll.review",PAYROLL_APPROVE:"payroll.approve",BILLING_REVIEW:"billing.review",BILLING_APPROVE:"billing.approve",DOCUMENT_DOWNLOAD:"document.download",DAILY_REPORT_VIEW:"daily-report.view",REPORT_SETTINGS_MANAGE:"report-settings.manage",VISITOR_CONTACT_VIEW:"visitor-contact.view" } as const;
export type Capability=typeof CAPABILITIES[keyof typeof CAPABILITIES];
const grants:Record<Role,ReadonlySet<Capability>>={RECEPTION:new Set(),MANAGER:new Set([CAPABILITIES.PAYROLL_REVIEW,CAPABILITIES.BILLING_REVIEW,CAPABILITIES.DOCUMENT_DOWNLOAD,CAPABILITIES.DAILY_REPORT_VIEW,CAPABILITIES.VISITOR_CONTACT_VIEW]),DIRECTOR:new Set(Object.values(CAPABILITIES)),ADMINISTRATOR:new Set(Object.values(CAPABILITIES))};
export const hasCapability=(role:Role,capability:Capability)=>grants[role].has(capability);
export async function requireCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session||!session.user.active||!hasCapability(session.user.role,capability))throw new Error("UNAUTHORISED");return session.user;}