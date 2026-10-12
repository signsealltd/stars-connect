"use client";
import type {EvidenceDetails} from "@/lib/training-status";
export function TrainingEvidenceFields({value,set,instructions}:{value:EvidenceDetails;set:(value:EvidenceDetails)=>void;instructions?:string}){
 return <fieldset className="full training-fieldset"><legend>Assessment / local evidence</legend>{instructions&&<p>{instructions}</p>}<p className="muted">File upload is optional. Record actual participation or observed assessment; do not substitute an online result.</p>
 {([["assessor","Assessor / trainer / verifying manager"],["scope","Observed assessment, checklist, equipment and client-plan scope"],["standards","Assessed standards and final sign-off"],["clientId","Client reference"],["planId","Plan reference"],["planVersion","Plan version"],["verificationReason","Prior achievement verification / equivalent evidence"]] as const).map(([key,label])=><label key={key}>{label}<input className="field" value={value[key]||""} onChange={e=>set({...value,[key]:e.target.value})}/></label>)}
 <label>Outcome<select className="field" value={value.outcome||""} onChange={e=>set({...value,outcome:e.target.value})}><option value="">Select outcome</option><option value="PASSED">Competent / passed</option><option value="FAILED">Not yet competent / failed</option><option value="ATTENDED">Attended / participated</option></select></label>
 <label>Actual first-aid qualification<select className="field" value={value.qualification||""} onChange={e=>set({...value,qualification:e.target.value})}><option value="">Not applicable</option><option>EFAW</option><option>FAW</option></select></label>
 <label><input type="checkbox" checked={!!value.verifiedPriorAchievement} onChange={e=>set({...value,verifiedPriorAchievement:e.target.checked})}/>Manager-verified prior Care Certificate achievement / equivalent evidence</label>
 <label>Formal practical training date<input className="field" type="date" value={value.formalTrainingDate||""} onChange={e=>set({...value,formalTrainingDate:e.target.value})}/></label>
 <label>Trainer-directed formal refresher interval (months)<input className="field" type="number" min="1" max="120" value={value.formalRefresherMonths||""} onChange={e=>set({...value,formalRefresherMonths:e.target.value?Number(e.target.value):undefined})}/></label>
 <label>Last annual first-aid refresher date<input className="field" type="date" value={value.refresherDate||""} onChange={e=>set({...value,refresherDate:e.target.value})}/></label>
 </fieldset>;
}
