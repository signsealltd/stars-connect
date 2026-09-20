import {clientTerminology} from "./terminology";
import type {Role} from "@prisma/client";
export const CAPABILITIES = {VEHICLE_CHECK:"vehicle.check",FLEET_VIEW:"fleet.view",FLEET_MANAGE:"fleet.manage",FLEET_RETURN:"fleet.return",INFORMATION_REVIEW_VIEW:"information-review.view",INFORMATION_REVIEW_MANAGE:"information-review.manage",INFORMATION_REVIEW_APPROVE:"information-review.approve",OPERATIONS_VIEW:"operations.view",OPERATIONS_CREATE:"operations.create",OPERATIONS_EDIT:"operations.edit",OPERATIONS_ASSIGN_STAFF:"operations.assign_staff",OPERATIONS_ASSIGN_ATTENDEES:"operations.assign_attendees",OPERATIONS_APPROVE:"operations.approve",OPERATIONS_START:"operations.start",OPERATIONS_COMPLETE:"operations.complete",OPERATIONS_CANCEL:"operations.cancel",STAFF_SCHEDULE_VIEW:"staff_schedule.view",STAFF_SCHEDULE_MANAGE:"staff_schedule.manage",STAFF_SCHEDULE_APPROVE:"staff_schedule.approve",ATTENDANCE_EXPECTED_VIEW:"attendance_expected.view",ATTENDANCE_RECONCILIATION_VIEW:"attendance_reconciliation.view",ATTENDANCE_RECONCILIATION_MANAGE:"attendance_reconciliation.manage",CALENDAR_VIEW:"calendar.view",CALENDAR_MANAGE:"calendar.manage",DIRECTOR_DASHBOARD_VIEW:"director_dashboard.view",BILLING_EDIT:"billing.edit",VISITOR_SETTINGS:"visitor-settings.manage",KIOSK_SETTINGS:"kiosk-settings.manage",ASSISTANT_USE:"assistant.use",STUDENT_CARE_EDIT:"student-care.manage", SYSTEM_VIEW:"system.view",SYSTEM_MANAGE:"system.manage",PHOTO_VIEW:"photo.view", DASHBOARD_VIEW:"dashboard.view",DASHBOARD_MANAGE:"dashboard.manage",STAFF_VIEW:"staff.view",STAFF_MANAGE:"staff.manage",STUDENTS_VIEW:"students.view",STUDENTS_MANAGE:"students.manage",REGISTER_VIEW:"register.view",REGISTER_MANAGE:"register.manage",LIVE_VIEW:"live.view",LIVE_MANAGE:"live.manage",TIMESHEETS_VIEW:"timesheets.view",TIMESHEETS_MANAGE:"timesheets.manage",REPORTS_VIEW:"reports.view",REPORTS_MANAGE:"reports.manage",EMERGENCY_VIEW:"emergency.view",EMERGENCY_MANAGE:"emergency.manage",VISITORS_VIEW:"visitors.view",VISITORS_MANAGE:"visitors.manage",TRAINING_VIEW:"training.view",TRAINING_MANAGE:"training.manage",PREMISES_VIEW:"premises.view",PREMISES_MANAGE:"premises.manage",DEVICES_VIEW:"devices.view",DEVICES_MANAGE:"devices.manage",USERS_VIEW:"users.view",USERS_MANAGE:"users.manage",SETTINGS_VIEW:"settings.view",SETTINGS_MANAGE:"settings.manage",AUDIT_VIEW:"audit.view",AUDIT_MANAGE:"audit.manage",SYNCHRONISATION_VIEW:"synchronisation.view",SYNCHRONISATION_MANAGE:"synchronisation.manage",CONFLICTS_VIEW:"conflicts.view",CONFLICTS_MANAGE:"conflicts.manage", STAFF_PORTAL:"staff-portal.view",STAFF_RESOURCES_MANAGE:"staff-resources.manage",STAFF_POLICIES:"staff-policies.view",STAFF_RIDDOR:"staff-riddor.view",STAFF_SDS:"staff-sds.view",STAFF_RAMS:"staff-rams.view",STAFF_CALENDAR:"staff-calendar.view",STAFF_TRAINING:"staff-training.view",SAFEGUARDING_MANAGE:"safeguarding.manage",STUDENT_CARE:"student-care.view", PAYROLL_REVIEW:"payroll.review",PAYROLL_APPROVE:"payroll.approve",BILLING_REVIEW:"billing.review",BILLING_APPROVE:"billing.approve",DOCUMENT_DOWNLOAD:"document.download",DAILY_REPORT_VIEW:"daily-report.view",REPORT_SETTINGS_MANAGE:"report-settings.manage",VISITOR_CONTACT_VIEW:"visitor-contact.view",VISITOR_SIGNATURE_VIEW:"visitor-signature.view",COMPLIANCE_VIEW:"compliance.view",COMPLIANCE_MANAGE:"compliance.manage",COMPLIANCE_SETTINGS_MANAGE:"compliance.settings.manage",COMPLIANCE_REPORTS_VIEW:"compliance.reports.view",COMPLIANCE_ACTION_MANAGE:"compliance-action.manage",COMPLIANCE_SENSITIVE_VIEW:"compliance-sensitive.view",RISK_ASSESSMENT_VIEW:"risk-assessment.view",RISK_ASSESSMENT_CREATE:"risk-assessment.create",RISK_ASSESSMENT_EDIT:"risk-assessment.edit",RISK_ASSESSMENT_APPROVE:"risk-assessment.approve",RISK_ASSESSMENT_PUBLISH:"risk-assessment.publish",RAMS_VIEW:"rams.view",RAMS_CREATE:"rams.create",RAMS_EDIT:"rams.edit",RAMS_APPROVE:"rams.approve",COSHH_VIEW:"coshh.view",COSHH_MANAGE:"coshh.manage",POLICY_VIEW:"policy.view",POLICY_MANAGE:"policy.manage",POLICY_APPROVE:"policy.approve",COMPLIANCE_ACKNOWLEDGE:"compliance.acknowledge" } as const;
export type Capability=typeof CAPABILITIES[keyof typeof CAPABILITIES];
const staffGrants:Capability[]=[CAPABILITIES.VEHICLE_CHECK,CAPABILITIES.ASSISTANT_USE,CAPABILITIES.STAFF_PORTAL,CAPABILITIES.STAFF_POLICIES,CAPABILITIES.STAFF_RIDDOR,CAPABILITIES.STAFF_SDS,CAPABILITIES.STAFF_RAMS,CAPABILITIES.STAFF_CALENDAR,CAPABILITIES.STAFF_TRAINING];
const grants:Record<Role,ReadonlySet<Capability>>={TEAM_LEADER:new Set(staffGrants),CARE_ASSISTANT:new Set(staffGrants),RECEPTION:new Set(staffGrants),MANAGER:new Set([...staffGrants,CAPABILITIES.FLEET_VIEW,CAPABILITIES.FLEET_MANAGE,CAPABILITIES.FLEET_RETURN,CAPABILITIES.OPERATIONS_VIEW,CAPABILITIES.OPERATIONS_CREATE,CAPABILITIES.OPERATIONS_EDIT,CAPABILITIES.OPERATIONS_ASSIGN_STAFF,CAPABILITIES.OPERATIONS_ASSIGN_ATTENDEES,CAPABILITIES.OPERATIONS_START,CAPABILITIES.OPERATIONS_COMPLETE,CAPABILITIES.OPERATIONS_CANCEL,CAPABILITIES.STAFF_SCHEDULE_VIEW,CAPABILITIES.STAFF_SCHEDULE_MANAGE,CAPABILITIES.ATTENDANCE_EXPECTED_VIEW,CAPABILITIES.ATTENDANCE_RECONCILIATION_VIEW,CAPABILITIES.ATTENDANCE_RECONCILIATION_MANAGE,CAPABILITIES.CALENDAR_VIEW,CAPABILITIES.CALENDAR_MANAGE,CAPABILITIES.INFORMATION_REVIEW_VIEW,CAPABILITIES.INFORMATION_REVIEW_MANAGE,CAPABILITIES.INFORMATION_REVIEW_APPROVE,CAPABILITIES.KIOSK_SETTINGS,CAPABILITIES.STAFF_RESOURCES_MANAGE,CAPABILITIES.SAFEGUARDING_MANAGE,CAPABILITIES.STUDENT_CARE,CAPABILITIES.STUDENT_CARE_EDIT,CAPABILITIES.BILLING_EDIT,CAPABILITIES.COMPLIANCE_VIEW,CAPABILITIES.COMPLIANCE_MANAGE,CAPABILITIES.COMPLIANCE_REPORTS_VIEW,CAPABILITIES.COMPLIANCE_ACTION_MANAGE,CAPABILITIES.RISK_ASSESSMENT_VIEW,CAPABILITIES.RISK_ASSESSMENT_CREATE,CAPABILITIES.RISK_ASSESSMENT_EDIT,CAPABILITIES.RAMS_VIEW,CAPABILITIES.RAMS_CREATE,CAPABILITIES.RAMS_EDIT,CAPABILITIES.COSHH_VIEW,CAPABILITIES.COSHH_MANAGE,CAPABILITIES.POLICY_VIEW,CAPABILITIES.POLICY_MANAGE,CAPABILITIES.COMPLIANCE_ACKNOWLEDGE,CAPABILITIES.PAYROLL_REVIEW,CAPABILITIES.BILLING_REVIEW,CAPABILITIES.DOCUMENT_DOWNLOAD,CAPABILITIES.DAILY_REPORT_VIEW,CAPABILITIES.VISITOR_CONTACT_VIEW,CAPABILITIES.VISITOR_SIGNATURE_VIEW]),DIRECTOR:new Set(Object.values(CAPABILITIES)),ADMINISTRATOR:new Set(Object.values(CAPABILITIES))};
export const capabilityOptions=[
{key:CAPABILITIES.VEHICLE_CHECK,label:"Complete vehicle checks",description:"Submit own immutable checks and defect evidence."},
{key:CAPABILITIES.FLEET_VIEW,label:"Review fleet",description:"View checks, defects and private evidence; export records."},
{key:CAPABILITIES.FLEET_MANAGE,label:"Manage fleet",description:"Configure vehicles and record repair and verification actions."},
{key:CAPABILITIES.FLEET_RETURN,label:"Return vehicles to service",description:"Close verified defects and explicitly release a vehicle."},
{key:CAPABILITIES.INFORMATION_REVIEW_VIEW,label:"View information reviews",description:"View annual client information review requests and submissions."},
{key:CAPABILITIES.INFORMATION_REVIEW_MANAGE,label:"Manage information reviews",description:"Create, extend and revoke secure annual review requests."},
{key:CAPABILITIES.INFORMATION_REVIEW_APPROVE,label:"Approve information reviews",description:"Accept or reject proposed changes and complete a review."},
{key:CAPABILITIES.OPERATIONS_VIEW,label:"View operations",description:"View operational activities and readiness."},
{key:CAPABILITIES.OPERATIONS_CREATE,label:"Create operations",description:"Create operational activities and occurrences."},
{key:CAPABILITIES.OPERATIONS_EDIT,label:"Edit operations",description:"Edit permitted operation details."},
{key:CAPABILITIES.OPERATIONS_ASSIGN_STAFF,label:"Assign operation staff",description:"Assign staff to operational activities."},
{key:CAPABILITIES.OPERATIONS_ASSIGN_ATTENDEES,label:"Assign attendees",description:"Assign service users to operational activities."},
{key:CAPABILITIES.OPERATIONS_APPROVE,label:"Approve operations",description:"Approve operations after readiness review."},
{key:CAPABILITIES.OPERATIONS_START,label:"operations.start",description:"Allow operations.start access."},
{key:CAPABILITIES.OPERATIONS_COMPLETE,label:"operations.complete",description:"Allow operations.complete access."},
{key:CAPABILITIES.OPERATIONS_CANCEL,label:"operations.cancel",description:"Allow operations.cancel access."},
{key:CAPABILITIES.STAFF_SCHEDULE_VIEW,label:"View staff schedules",description:"View staff working patterns and dated shifts."},
{key:CAPABILITIES.STAFF_SCHEDULE_MANAGE,label:"Manage staff schedules",description:"Create working patterns and schedule exceptions."},
{key:CAPABILITIES.STAFF_SCHEDULE_APPROVE,label:"Approve staff schedules",description:"Approve schedule changes and exceptions."},
{key:CAPABILITIES.ATTENDANCE_EXPECTED_VIEW,label:"View expected attendance",description:"View who is expected to work."},
{key:CAPABILITIES.ATTENDANCE_RECONCILIATION_VIEW,label:"View attendance reconciliation",description:"Compare schedules with clocking records."},
{key:CAPABILITIES.ATTENDANCE_RECONCILIATION_MANAGE,label:"Resolve attendance discrepancies",description:"Resolve audited attendance discrepancies."},
{key:CAPABILITIES.CALENDAR_VIEW,label:"View operational calendar",description:"View schedule and operation calendar records."},
{key:CAPABILITIES.CALENDAR_MANAGE,label:"Manage operational calendar",description:"Manage permitted calendar source records."},
{key:CAPABILITIES.DIRECTOR_DASHBOARD_VIEW,label:"director_dashboard.view",description:"Allow director_dashboard.view access."},

{key:CAPABILITIES.BILLING_EDIT,label:"Edit funded billing",description:"Maintain funding agreements and PO numbers, prepare drafts and remove agreed days with a reason."},
{key:CAPABILITIES.VISITOR_SETTINGS,label:"Manage visitor configuration",description:"Change visitor reasons, rules and sign-in configuration."},{key:CAPABILITIES.KIOSK_SETTINGS,label:"Manage kiosk appearance",description:"Change screensaver and idle-display settings."},{key:CAPABILITIES.ASSISTANT_USE,label:"Use Clive guidance",description:"Ask the built-in system help assistant for guidance."},
{key:CAPABILITIES.STUDENT_CARE_EDIT,label:"Manage client care information",description:"Update photographs, returned care information and generate RAMS drafts."},
{key:CAPABILITIES.SYSTEM_VIEW,label:"View system and backups",description:"Inspect system health and available backups."},{key:CAPABILITIES.SYSTEM_MANAGE,label:"Manage system and backups",description:"Create, download or remove backups and run system maintenance."},{key:CAPABILITIES.PHOTO_VIEW,label:"View attendance photographs",description:"Access protected attendance photographs."},
 ...Object.entries(CAPABILITIES).filter(([key])=>["DASHBOARD", "STAFF", "STUDENTS", "REGISTER", "LIVE", "TIMESHEETS", "REPORTS", "EMERGENCY", "VISITORS", "TRAINING", "PREMISES", "DEVICES", "USERS", "SETTINGS", "AUDIT", "SYNCHRONISATION", "CONFLICTS"].some(module=>key===module+"_VIEW"||key===module+"_MANAGE")).map(([,key])=>({key,label:clientTerminology(key.replace("premises","Safety & Compliance").replace("."," — ")),description:clientTerminology(`Allow ${key.split(".")[1]} access to ${key.split(".")[0]}.`)})),
  ...(["STAFF_PORTAL","STAFF_RESOURCES_MANAGE","STAFF_POLICIES","STAFF_RIDDOR","STAFF_SDS","STAFF_RAMS","STAFF_CALENDAR","STAFF_TRAINING","SAFEGUARDING_MANAGE","STUDENT_CARE"] as const).map(key=>({key:CAPABILITIES[key],label:clientTerminology(key.toLowerCase().replaceAll("_"," ")),description:"Allow access to this staff or care workflow."})),
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
export const hasCapability=(role:Role,capability:Capability,permissionOverrides?:unknown)=>{
 const custom=overrides(permissionOverrides)[capability]; if(custom!==undefined)return custom;
 if([CAPABILITIES.SYSTEM_VIEW,CAPABILITIES.SYSTEM_MANAGE].includes(capability as typeof CAPABILITIES.SYSTEM_VIEW))return role==="ADMINISTRATOR";
 if(capability===CAPABILITIES.PHOTO_VIEW)return ["DIRECTOR","ADMINISTRATOR"].includes(role);
 if(capability===CAPABILITIES.VISITOR_SETTINGS)return role==="ADMINISTRATOR";
 const [module]=capability.split(".");
 if(["dashboard","staff","students","register","live","timesheets","reports","emergency","visitors","training","premises","devices","users","settings","audit","synchronisation","conflicts"].includes(module)) {
  if(role==="ADMINISTRATOR")return true;
  if(["TEAM_LEADER","CARE_ASSISTANT"].includes(role))return false;
  if(["users","settings","audit","devices","synchronisation","conflicts"].includes(module))return false;
  if(role==="DIRECTOR")return true;
  if(role==="MANAGER")return !["premises"].includes(module);
  return ["dashboard","register","live","emergency","visitors"].includes(module);
 }
 return grants[role].has(capability);
};
