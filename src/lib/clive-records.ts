import {NextRequest} from "next/server";
import type {User} from "@prisma/client";
import {localDateKey} from "./dates";
import {allowedCliveSources,cliveRecordSources,detectCliveSource,type CliveRecordSource} from "./clive-record-sources";
type Getter=()=>Promise<{GET:(req:NextRequest)=>Promise<Response>}>;
// Fixed internal handlers only. No URL, SQL, field list or identity supplied by the caller is executed.
const handlers:Record<string,Getter>={
 reports:()=>import("@/app/api/reports/route"),settings:()=>import("@/app/api/settings/route"),"my-training":()=>import("@/app/api/staff-area/route"),"my-schedule":()=>import("@/app/api/staff-area/route"),"my-requests":()=>import("@/app/api/staff-area/route"),
 training:()=>import("@/app/api/training/matrix/route"),providers:()=>import("@/app/api/training/configuration/route"),staff:()=>import("@/app/api/staff/route"),clients:()=>import("@/app/api/students/manage/route"),invoices:()=>import("@/app/api/billing/invoices/route"),payments:()=>import("@/app/api/payments/route"),payroll:()=>import("@/app/api/payroll/periods/route"),visitors:()=>import("@/app/api/visitors/route"),onsite:()=>import("@/app/api/live/route"),devices:()=>import("@/app/api/devices/route"),calendar:()=>import("@/app/api/calendar/route"),operations:()=>import("@/app/api/operations/route"),assets:()=>import("@/app/api/premises/route"),inspections:()=>import("@/app/api/premises/route"),fleet:()=>import("@/app/api/fleet/vehicles/route"),policies:()=>import("@/app/api/compliance/library/route"),coshh:()=>import("@/app/api/compliance/library/route"),medications:()=>import("@/app/api/medications/route"),reviews:()=>import("@/app/api/information-reviews/route"),audit:()=>import("@/app/api/audit/route"),users:()=>import("@/app/api/users/route"),conflicts:()=>import("@/app/api/conflicts/route")
};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
function at(value:unknown,path:string):unknown{return path.split(".").reduce<unknown>((v,key)=>v&&typeof v==="object"?(v as Record<string,unknown>)[key]:undefined,value);}
function scalar(value:unknown):string {if(value==null)return "";if(typeof value==="string")return value.replace(/[\u0000-\u001f]/g," ").slice(0,450);if(typeof value==="number"||typeof value==="boolean")return String(value);if(Array.isArray(value))return value.filter(v=>["string","number","boolean"].includes(typeof v)).slice(0,7).join(", ");return "";}
export function projectCliveRecords(source:CliveRecordSource,payload:unknown){
 const data=object(payload);let rows:unknown[];
 if(source.id==="training")rows=array(data.rows).flatMap(person=>array(object(person).cells).map(cell=>{const c=object(cell),p=object(person),course=array(data.courses).map(object).find(course=>course.id===c.courseId);return {Staff:p.name,Role:p.role,Course:course?.name,Requirement:c.requirement,Status:c.state,Completed:c.completedDate,Renewal:c.expiryDate};}));
 else if(source.collection==="onsite")rows=["staff","students","visitors"].flatMap(group=>array(data[group]).map(row=>({...object(row),group:group==="students"?"clients":group})));
 else if(source.collection==="single")rows=[data];
 else rows=array(source.collection?at(data,source.collection):payload);
 return rows.map(row=>Object.fromEntries(source.fields.map(field=>[field,scalar(at(row,field))]).filter(([,value])=>value!==""))).filter(row=>Object.keys(row).length);
}
export async function readCliveRecords(user:User,question:string,options:{source?:string;search?:string;from?:string;to?:string}={},read?:(source:CliveRecordSource,request:NextRequest)=>Promise<Response>){
 const source=options.source?cliveRecordSources.find(s=>s.id===options.source):detectCliveSource(question);
 if(!source)return options.source?{answer:"That live lookup is not supported. Choose an area from Live records.",mode:"live"}:null;
 if(!allowedCliveSources(user).some(s=>s.id===source.id))return {answer:"You do not have permission to look up records in that area.",mode:"live"};
 if(["hr","absences"].includes(source.id)&&!(options.search||question.match(/"([^"\n]{1,100})"/)?.[1]))return {answer:"Choose this area in Live records and enter the exact staff display name in Filter records. I will only open a single unambiguous match.",mode:"live"};
 const url=new URL(source.api,"https://stars.internal.invalid");let range="";
 if(["calendar","operations"].includes(source.id)){const day=localDateKey(),month=day.slice(0,7),next=new Date(`${month}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);url.searchParams.set("start",`${month}-01`);url.searchParams.set("end",next.toISOString().slice(0,10));range=` (${month}, Europe/London)`;}
 if(options.from||options.to){
  const from=options.from||options.to!,to=options.to||options.from!,start=new Date(from),end=new Date(to);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(+start)||!Number.isFinite(+end)||end<start||+end-+start>92*86400000)return {answer:"Choose a valid date range of at most 93 days.",mode:"live"};
  if(!["calendar","operations","reports"].includes(source.id))return {answer:"Date filtering for this lookup is available on its source screen.",mode:"live",suggestedRoute:source.page};
  if(source.id==="reports"){url.searchParams.set("from",from);url.searchParams.set("to",to);}else{url.searchParams.set("start",from);end.setUTCDate(end.getUTCDate()+1);url.searchParams.set("end",end.toISOString().slice(0,10));}range=` (${from} to ${to})`;
 }
 try{
  // Calling the existing handler runs its normal session, organisation and per-record guards again.
  const response=await (read?read(source,new NextRequest(url)):["hr","absences"].includes(source.id)?readNamedStaff(source,options.search||question.match(/"([^"\n]{1,100})"/)?.[1]||"",new NextRequest(url)):handlers[source.id]().then(module=>module.GET(new NextRequest(url))));
  if(!response.ok)return {answer:response.status===401||response.status===403?"Your current permissions do not allow this lookup.":"The source records could not be loaded. Open the source screen or try again; no records were changed.",mode:"live"};
  const rows=projectCliveRecords(source,await response.json());
  const search=(options.search||question.match(/"([^"\n]{1,100})"/)?.[1]||"").trim().toLowerCase();
  const nameFields=["Staff","displayName","fullName","staffMember","student.displayName","clientName","studentName","client"];
  const qWords=new Set(question.toLowerCase().match(/[a-z]+/g)||[]);
  const namedRows=rows.filter(row=>nameFields.some(key=>String(row[key]||"").toLowerCase().split(/\s+/).some(word=>word.length>2&&qWords.has(word))));
  let matches=search&&!["hr","absences"].includes(source.id)?rows.filter(row=>Object.values(row).some(value=>String(value).toLowerCase().includes(search))):namedRows.length?namedRows:rows;
  const state=/\boverdue|\bexpired/i.test(question)?"EXPIRED":/requires? review|need.*review/i.test(question)?"REQUIRES_REVIEW":/not completed|missing training/i.test(question)?"MISSING":/due soon/i.test(question)?"DUE_SOON":null;
  if(source.id==="training"&&state)matches=matches.filter(row=>row.Status===state);
  const shown=matches.slice(0,12),lines=shown.map(row=>Object.entries(row).map(([key,value])=>`${key.replace(/student/gi,"client").replace(/\./g," ")}: ${value}`).join(" · "));
  return {answer:`${source.label} — live lookup${range}.\n${options.from||options.to?source.scope.replace("Current calendar month", "Selected date range").replace("Today's", "Selected date range for"):source.scope}.\n${matches.length} matching rows in the ${rows.length} rows returned by the source; showing ${shown.length}. These are not guaranteed whole-system totals.\n${lines.length?lines.join("\n"):"No matching rows in this returned set."}\nUse the source screen for full details, additional pages or a different date range. No records were changed.`,mode:"live",suggestedRoute:source.page,links:[{label:`Open ${source.label}`,href:source.page}],sourceId:source.id};
 }catch{return {answer:"The source records could not be loaded. Please try again or open the source screen. No records were changed.",mode:"live"};}
}

async function readNamedStaff(source:CliveRecordSource,name:string,request:NextRequest){
 const directory=await (await import("@/app/api/staff/route")).GET(new NextRequest("https://stars.internal.invalid/api/staff"));if(!directory.ok)return directory;
 const matches=array(await directory.json()).map(object).filter(row=>String(row.displayName||"").toLowerCase()===name.trim().toLowerCase());if(matches.length!==1)return new Response(null,{status:404});
 const id=String(matches[0].id);if(source.id==="hr"){request.nextUrl.searchParams.set("staffId",id);return (await import("@/app/api/staff-hr/route")).GET(request);}
 return (await import("@/app/api/staff/[id]/absences/route")).GET(new NextRequest(`https://stars.internal.invalid/api/staff/${encodeURIComponent(id)}/absences`),{params:Promise.resolve({id})});
}
