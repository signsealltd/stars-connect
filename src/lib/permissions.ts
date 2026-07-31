import type { Role, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { AccessError, getSession } from "./security";
export const CAPABILITIES = { PAYROLL_REVIEW:"payroll.review",PAYROLL_APPROVE:"payroll.approve",BILLING_REVIEW:"billing.review",BILLING_APPROVE:"billing.approve",DOCUMENT_DOWNLOAD:"document.download",DAILY_REPORT_VIEW:"daily-report.view",REPORT_SETTINGS_MANAGE:"report-settings.manage",VISITOR_CONTACT_VIEW:"visitor-contact.view",VISITOR_SIGNATURE_VIEW:"visitor-signature.view",COMPLIANCE_VIEW:"compliance.view",COMPLIANCE_MANAGE:"compliance.manage",COMPLIANCE_SETTINGS_MANAGE:"compliance.settings.manage",COMPLIANCE_REPORTS_VIEW:"compliance.reports.view",COMPLIANCE_ACTION_MANAGE:"compliance-action.manage",COMPLIANCE_SENSITIVE_VIEW:"compliance-sensitive.view",RISK_ASSESSMENT_VIEW:"risk-assessment.view",RISK_ASSESSMENT_CREATE:"risk-assessment.create",RISK_ASSESSMENT_EDIT:"risk-assessment.edit",RISK_ASSESSMENT_APPROVE:"risk-assessment.approve",RISK_ASSESSMENT_PUBLISH:"risk-assessment.publish",RAMS_VIEW:"rams.view",RAMS_CREATE:"rams.create",RAMS_EDIT:"rams.edit",RAMS_APPROVE:"rams.approve",COSHH_VIEW:"coshh.view",COSHH_MANAGE:"coshh.manage",POLICY_VIEW:"policy.view",POLICY_MANAGE:"policy.manage",POLICY_APPROVE:"policy.approve",COMPLIANCE_ACKNOWLEDGE:"compliance.acknowledge" } as const;
export type Capability=typeof CAPABILITIES[keyof typeof CAPABILITIES];
const grants:Record<Role,ReadonlySet<Capability>>={RECEPTION:new Set(),MANAGER:new Set([CAPABILITIES.COMPLIANCE_VIEW,CAPABILITIES.COMPLIANCE_MANAGE,CAPABILITIES.COMPLIANCE_REPORTS_VIEW,CAPABILITIES.COMPLIANCE_ACTION_MANAGE,CAPABILITIES.RISK_ASSESSMENT_VIEW,CAPABILITIES.RISK_ASSESSMENT_CREATE,CAPABILITIES.RISK_ASSESSMENT_EDIT,CAPABILITIES.RAMS_VIEW,CAPABILITIES.RAMS_CREATE,CAPABILITIES.RAMS_EDIT,CAPABILITIES.COSHH_VIEW,CAPABILITIES.COSHH_MANAGE,CAPABILITIES.POLICY_VIEW,CAPABILITIES.POLICY_MANAGE,CAPABILITIES.COMPLIANCE_ACKNOWLEDGE,CAPABILITIES.PAYROLL_REVIEW,CAPABILITIES.BILLING_REVIEW,CAPABILITIES.DOCUMENT_DOWNLOAD,CAPABILITIES.DAILY_REPORT_VIEW,CAPABILITIES.VISITOR_CONTACT_VIEW,CAPABILITIES.VISITOR_SIGNATURE_VIEW]),DIRECTOR:new Set(Object.values(CAPABILITIES)),ADMINISTRATOR:new Set(Object.values(CAPABILITIES))};
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
  {key:CAPABILITIES.COMPLIANCE_VIEW,label:"View compliance",description:"View permitted compliance records and dashboards."},
  {key:CAPABILITIES.COMPLIANCE_MANAGE,label:"Manage compliance",description:"Create and edit operational compliance drafts."},
  {key:CAPABILITIES.COMPLIANCE_SETTINGS_MANAGE,label:"Manage compliance settings",description:"Manage categories, risk matrices and templates."},
  {key:CAPABILITIES.COMPLIANCE_REPORTS_VIEW,label:"View compliance reports",description:"View and export compliance reports."},
  {key:CAPABILITIES.COMPLIANCE_ACTION_MANAGE,label:"Manage compliance actions",description:"Create, assign and complete compliance actions."},
  {key:CAPABILITIES.COMPLIANCE_SENSITIVE_VIEW,label:"View sensitive compliance links",description:"View authorised service-user-specific safety links."},
  {key:CAPABILITIES.RISK_ASSESSMENT_VIEW,label:"View risk assessments",description:"View permitted risk assessments."},
  {key:CAPABILITIES.RISK_ASSESSMENT_CREATE,label:"Create risk assessments",description:"Create risk-assessment drafts."},
  {key:CAPABILITIES.RISK_ASSESSMENT_EDIT,label:"Edit risk assessments",description:"Edit risk-assessment drafts."},
  {key:CAPABILITIES.RISK_ASSESSMENT_APPROVE,label:"Approve risk assessments",description:"Approve or reject submitted risk assessments."},
  {key:CAPABILITIES.RISK_ASSESSMENT_PUBLISH,label:"Publish risk assessments",description:"Publish approved risk-assessment versions."},
  {key:CAPABILITIES.RAMS_VIEW,label:"View RAMS",description:"View permitted RAMS records."},
  {key:CAPABILITIES.RAMS_CREATE,label:"Create RAMS",description:"Create RAMS drafts."},
  {key:CAPABILITIES.RAMS_EDIT,label:"Edit RAMS",description:"Edit RAMS drafts."},
  {key:CAPABILITIES.RAMS_APPROVE,label:"Approve RAMS",description:"Approve or reject submitted RAMS."},
  {key:CAPABILITIES.COSHH_VIEW,label:"View COSHH",description:"View the COSHH register and assessments."},
  {key:CAPABILITIES.COSHH_MANAGE,label:"Manage COSHH",description:"Manage COSHH products, SDS versions and assessments."},
  {key:CAPABILITIES.POLICY_VIEW,label:"View policies",description:"View assigned published policies."},
  {key:CAPABILITIES.POLICY_MANAGE,label:"Manage policies",description:"Create and edit controlled policy drafts."},
  {key:CAPABILITIES.POLICY_APPROVE,label:"Approve policies",description:"Approve and publish controlled policies."},
  {key:CAPABILITIES.COMPLIANCE_ACKNOWLEDGE,label:"Acknowledge documents",description:"Acknowledge assigned published compliance documents."},] as const;
function overrides(value:unknown):Partial<Record<Capability,boolean>>{if(!value||typeof value!=="object"||Array.isArray(value))return{};return value as Partial<Record<Capability,boolean>>}
export const hasCapability=(role:Role,capability:Capability,permissionOverrides?:unknown)=>overrides(permissionOverrides)[capability]??grants[role].has(capability);
export async function requireCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session)throw new AccessError(401,"AUTHENTICATION_REQUIRED");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))throw new AccessError(403,"FORBIDDEN");return session.user;}
export async function requirePageCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session||!session.user.active)redirect("/login");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))redirect(`/access-denied?from=${encodeURIComponent(capability)}`);return session.user;}
