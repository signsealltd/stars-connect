import online from "./training-policy-online.json";
import {trainingRoles} from "./training-matrix";

export const policyVersion="STARS-2026-10-12";
export const policyRoles={AM:"Assistant Manager",TL:"Team Leader",SW:"Support Worker"} as const;
export type CoursePolicy={version?:string;renewalKind?:"RENEWAL"|"REVIEW"|"ONE_OFF"|"ON_PLAN_CHANGE";instructions?:string;formalRefresherMonths?:number;annualReminderMonths?:number;component?:string};
export function readPolicy(value:unknown):CoursePolicy{return value&&typeof value==="object"&&!Array.isArray(value)?value as CoursePolicy:{};}
const additional:[string,string,number|null,boolean,CoursePolicy][]=[
 ["Oliver McGowan Tier 2 — Face-to-Face Training","EXTERNAL",36,true,{component:"OLIVER_FACE_TO_FACE",instructions:"Record provider attendance/completion details. Online learning does not complete this element."}],
 ["Buccal Midazolam — Practical Training and Competency","PRACTICAL",12,false,{formalRefresherMonths:24,instructions:"Designated rescue-medication administrators only. Record assessor, outcome, assessment date and client-plan briefing. Record formal practical training date and trainer interval separately."}],
 ["Medication Administration — Practical Competency","PRACTICAL",12,false,{instructions:"Medication administrators only. Record observed assessment, assessor and outcome. Request earlier reassessment after concerns, incidents or changes."}],
 ["Moving and Handling People — Practical Competency","PRACTICAL",12,false,{instructions:"Staff assisting transfers/handling equipment only. Record equipment/client scope and assessor."}],
 ["Basic Life Support, CPR and AED — Practical Skills","PRACTICAL",12,true,{instructions:"Record observed practical skills and assessor. Online BLS does not satisfy this requirement."}],
 ["Care Certificate — Workplace Assessment","PRACTICAL",null,false,{renewalKind:"ONE_OFF",component:"CARE_WORKPLACE",instructions:"Staff completing the Care Certificate. Record assessed standards and final assessor sign-off, or manager-verified prior achievement/equivalent evidence."}],
 ["STARS Local Induction","LOCAL",null,true,{renewalKind:"ONE_OFF",instructions:"Record completed induction checklist. Request update after relevant changes."}],
 ["Fire Evacuation, PEEPs and Site Familiarisation","LOCAL",12,true,{instructions:"Record actual participation initially, annually and after site/procedure changes. Policy acknowledgement alone is insufficient."}],
 ["Missing Person and Herbert Protocol — Local Procedures","LOCAL",12,true,{instructions:"Record local briefing/scenario participation."}],
 ["Safeguarding, Reporting Concerns and Whistleblowing — Local Update","LOCAL",12,true,{instructions:"Record local briefing/knowledge check."}],
 ["Incident Reporting, Handover and STARS Connect","LOCAL",null,true,{renewalKind:"ONE_OFF",instructions:"Record local systems/process training. Request update on change."}],
 ["Outings, Community Safety and Transport Procedures","LOCAL",12,false,{instructions:"Required when involved in outings or transport."}],
 ["Client-Specific Care and Emergency Plan Briefing","LOCAL",null,false,{renewalKind:"ON_PLAN_CHANGE",instructions:"Assign each supported client and current plan/version individually. Record the matching client, plan/version and briefing date; update required after a material plan change."}],
 ["Dysphagia and Safe Mealtime Support — Practical Competency","PRACTICAL",12,false,{instructions:"Staff supporting swallowing risks only. Record assessment against the individual plan. A justified clinician/SALT interval can override the default."}],
 ["Emergency First Aid at Work / First Aid at Work","EXTERNAL",36,false,{annualReminderMonths:12,instructions:"Designated first aiders only. Record actual qualification EFAW or FAW and qualification expiry. Annual refresher is a separate reminder, not qualification expiry."}],
];
function rules(roles:string[],required:boolean){return Object.fromEntries(trainingRoles.map(role=>[role,roles.includes(role)?required?"REQUIRED":"CONDITIONAL":"NOT_REQUIRED"]));}
export const canonicalTrainingCourses=[
 ...online.map(course=>({name:course.name,category:"Online training",evidenceKind:"THEORY",renewalMonths:course.renewalMonths,warningDays:60,requirementRules:rules(course.roles.map(r=>policyRoles[r as keyof typeof policyRoles]),true),policy:{version:policyVersion,renewalKind:course.renewalKind,...(course.name==="The Oliver McGowan Mandatory Training"?{component:"OLIVER_ONLINE",instructions:"Treat as e-learning only unless provider metadata is verified otherwise. Tier 2 also requires the face-to-face element."}:course.name==="Care Certificate (Careskills)"?{component:"CARE_ONLINE",instructions:"Online component only. Overall achievement requires workplace assessment or verified prior achievement."}:{})} as CoursePolicy})),
 ...additional.map(([name,evidenceKind,renewalMonths,required,policy])=>({name,category:"Practical, local & external",evidenceKind,renewalMonths,warningDays:60,requirementRules:rules(Object.values(policyRoles),required),policy:{version:policyVersion,renewalKind:"RENEWAL" as const,...policy}})),
];
export function verifyCanonicalCatalogue(){
 const totals=Object.fromEntries(Object.values(policyRoles).map(role=>[role,canonicalTrainingCourses.filter(c=>c.evidenceKind==="THEORY"&&c.requirementRules[role]==="REQUIRED").length]));
 if(canonicalTrainingCourses.length!==60||new Set(canonicalTrainingCourses.map(c=>c.name)).size!==60||totals[policyRoles.AM]!==44||totals[policyRoles.TL]!==43||totals[policyRoles.SW]!==37)throw new Error("Canonical training catalogue validation failed.");
 return {online:45,additional:15,roles:totals};
}
