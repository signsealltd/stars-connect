
import {protectedTrainingEntries,needsFullTier2Verification} from "./training-catalogue";
import {IhascoError} from "./ihasco-client";
import type {IhCode,IhResult,IhUser} from "./ihasco-client";

export function matchIhascoEmail(user:IhUser,users:IhUser[],staff:{id:string;email:string}[]) {
  const email=user.email?.trim().toLowerCase();
  if(!email)return {staffId:null,state:"MISSING_EMAIL"};
  const candidates=staff.filter(s=>s.email.trim().toLowerCase()===email);
  if(users.filter(u=>u.email?.trim().toLowerCase()===email).length!==1||candidates.length>1)return {staffId:null,state:"AMBIGUOUS_EMAIL"};
  return candidates.length===1?{staffId:candidates[0].id,state:"EXACT_EMAIL"}:{staffId:null,state:"UNMATCHED_EMAIL"};
}
export function onlineCourseAllowed(course:{name:string;evidenceKind?:string;active?:boolean}) {
  return course.active!==false && ["COURSE","THEORY"].includes(course.evidenceKind||"COURSE") && !needsFullTier2Verification(course) && !protectedTrainingEntries.some(c=>c.name===course.name) && !/practical|competency|face.to.face|workplace assessment|local induction|administration & competency|first aid at work|site familiarisation|oliver.*(?:part\s*2|tier\s*2)/i.test(course.name);
}
export function qualifiesIhasco(result:IhResult,codes:IhCode[],approved:IhCode[]) {
  const status=codes.find(c=>c.code===result.status_code);
  return !!status&&!/fail|in.?progress|not.?started|viewed/i.test(status.description)&&(!/^(test complete|expired|expiring soon)$/i.test(status.description)||(result.pass_mark!=null&&result.test_score!=null&&result.test_score>=result.pass_mark))&&approved.some(c=>c.code===status.code&&c.description===status.description)&&(result.pass_mark==null||result.test_score!=null&&result.test_score>=result.pass_mark);
}
export function providerDate(value:string|null|undefined) {
  if(!value)return null;
  // Preserve the provider's calendar date; do not invent a timezone for its timestamps.
  const key=value.slice(0,10),date=new Date(`${key}T00:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==key)throw new IhascoError("DATE","iHasco returned an invalid calendar date. Review the provider result; no checkpoint was advanced.");
  return date;
}
export function renewalDates(completed:Date|null,providerExpiry:Date|null,renewalMonths:number|null) {
  const stars=completed&&renewalMonths?new Date(Date.UTC(completed.getUTCFullYear(),completed.getUTCMonth()+renewalMonths,Math.min(completed.getUTCDate(),new Date(Date.UTC(completed.getUTCFullYear(),completed.getUTCMonth()+renewalMonths+1,0)).getUTCDate()))):null;
  return {stars,applicable:stars&&providerExpiry?new Date(Math.min(+stars,+providerExpiry)):stars||providerExpiry};
}
export function syncRange(checkpoint:Date|null,lastFull:Date|null,now:Date) {
  const full=!checkpoint||!lastFull||+now-+lastFull>=30*86400000;
  const query=new URLSearchParams({include_archived:"1"});
  if(!full){query.set("completion_date_from",new Date(+checkpoint!-7*86400000).toISOString().slice(0,10));query.set("completion_date_to",now.toISOString().slice(0,10));}
  return {full,path:`/results?${query}`};
}
export const checkpointMayAdvance=(counts:{failed:number;unmatched:number})=>counts.failed===0&&counts.unmatched===0;
