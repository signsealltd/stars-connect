import {createHash} from "node:crypto";
import {onlineCourseAllowed} from "./ihasco-rules";
import {explicitNumberedLevel} from "./training-catalogue";
import {trainingRoles} from "./training-matrix";

type ExternalCourse={externalId:string;title:string;courseId:string|null};
type LocalCourse={id:string;name:string;evidenceKind?:string;active?:boolean};
const titleKey=(title:string)=>title.trim().replace(/\s+/g," ").toLowerCase();
const subjectKey=(title:string)=>titleKey(title).replace(/\s*\((?:careskills(?: elearning)?|flexebee)\)\s*/g," ").trim();

export function newIhascoCourse(title:string) {
  const provider=/\(careskills(?: elearning)?\)/i.test(title)?"Careskills":/\(flexebee\)/i.test(title)?"Flexebee":"iHasco";
  return {name:title,provider,category:"iHasco online training",evidenceKind:"THEORY",integrationSource:"IHASCO",numberedLevel:explicitNumberedLevel(title),renewalMonths:null,requirementRules:Object.fromEntries(trainingRoles.map(role=>[role,"OPTIONAL"]))};
}

export function catalogueImportProposal(mappings:ExternalCourse[],courses:LocalCourse[],revision:number,reset=false) {
  if(reset)mappings=mappings.map(mapping=>({...mapping,courseId:null}));
  const rows=mappings.map(mapping=>{
    const base={externalId:mapping.externalId,title:mapping.title,courseId:null as string|null,courseName:null as string|null};
    const review=(reason:string)=>({...base,action:"REVIEW" as const,reason});
    if(mapping.courseId){const course=courses.find(c=>c.id===mapping.courseId);return {...base,courseId:mapping.courseId,courseName:course?.name||null,action:"LINKED" as const,reason:"Existing mapping retained"};}
    if(!onlineCourseAllowed({name:mapping.title,evidenceKind:"THEORY"}))return review("Practical or full-package title needs individual review");
    if(mappings.filter(other=>titleKey(other.title)===titleKey(mapping.title)).length!==1)return review("Multiple iHasco IDs share this title");
    const exact=courses.filter(c=>titleKey(c.name)===titleKey(mapping.title));
    if(exact.length){
      if(exact.length!==1||!onlineCourseAllowed({...exact[0],...(reset?{active:true}:{})}))return review("Existing course is inactive, protected or ambiguous");
      const course=exact[0];
      if(mappings.some(other=>other.courseId===course.id))return review("This STARS course is already mapped to another iHasco ID");
      return {...base,courseId:course.id,courseName:course.name,action:"MATCH" as const,reason:"Exact title match"};
    }
    if(!reset&&courses.some(c=>subjectKey(c.name)===subjectKey(mapping.title)))return review("Similar title with a different or missing provider label — select the existing course individually");
    return {...base,courseName:mapping.title,action:"CREATE" as const,reason:"Add as optional online theory; renewal unset"};
  }).sort((a,b)=>a.externalId.localeCompare(b.externalId));
  const retained=new Set(rows.flatMap(row=>row.courseId?[row.courseId]:[]));
  const archive=reset?courses.filter(course=>onlineCourseAllowed(course)&&!retained.has(course.id)).map(course=>({id:course.id,name:course.name})).sort((a,b)=>a.id.localeCompare(b.id)):[];
  return {token:createHash("sha256").update(JSON.stringify({revision,reset,rows,archive})).digest("hex"),rows,archive};
}

// Provider suffixes, levels and variants remain part of the title. Only unique
// exact titles are eligible for bulk confirmation; nothing is merged or created.
export function courseMappingProposal(mappings:ExternalCourse[],courses:LocalCourse[],revision:number) {
  const eligible=courses.filter(onlineCourseAllowed);
  const pairs=mappings.filter(m=>!m.courseId).flatMap(m=>{
    const candidates=eligible.filter(c=>titleKey(c.name)===titleKey(m.title));
    if(candidates.length!==1||mappings.filter(other=>titleKey(other.title)===titleKey(m.title)).length!==1)return [];
    const course=candidates[0];
    if(mappings.some(other=>other.courseId===course.id))return [];
    return [{externalId:m.externalId,title:m.title,courseId:course.id,courseName:course.name}];
  }).sort((a,b)=>a.externalId.localeCompare(b.externalId));
  const token=createHash("sha256").update(JSON.stringify({revision,pairs})).digest("hex");
  return {token,pairs};
}
