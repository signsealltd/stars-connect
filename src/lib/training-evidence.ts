import {readPolicy} from "./training-policy";
import {objectValue,type EvidenceDetails} from "./training-status";
export function trainingEvidenceError(course:{policy?:unknown;evidenceKind?:string},details:unknown){
 const policy=readPolicy(course.policy),e=objectValue<EvidenceDetails>(details);
 if(!policy.version||course.evidenceKind==="THEORY")return null;
 if(e.verifiedPriorAchievement){if(e.outcome==="FAILED")return "Failed assessment cannot verify prior achievement.";if(policy.component!=="CARE_WORKPLACE"||!e.verificationReason?.trim()||!e.assessor?.trim())return "Record the verifying manager and reason for prior Care Certificate achievement.";return null;}
 if(!e.assessor?.trim())return "Record the assessor, trainer or person delivering the briefing.";
 if(course.evidenceKind==="PRACTICAL"&&e.outcome==="ATTENDED")return "Practical competency needs an assessment outcome, not attendance alone.";
 if(!e.outcome)return "Record the assessment or attendance outcome.";
 if(policy.formalRefresherMonths&&!e.formalTrainingDate)return "Record the formal practical training date separately from the competency assessment date.";
 if(policy.renewalKind==="ON_PLAN_CHANGE"&&(!e.clientId||!e.planId||!e.planVersion))return "Record the client, plan reference and version for this briefing.";
 if(policy.component==="CARE_WORKPLACE"&&!e.standards?.trim())return "Record assessed Care Certificate standards and final assessor sign-off.";
 if(policy.annualReminderMonths&&!e.qualification)return "Select the actual first-aid qualification: EFAW or FAW.";
 if(course.evidenceKind==="PRACTICAL"&&!e.scope?.trim())return "Record the observed assessment and its equipment/client-plan scope.";
 return null;
}
