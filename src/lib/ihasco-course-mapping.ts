import {createHash} from "node:crypto";
import {onlineCourseAllowed} from "./ihasco-rules";

type ExternalCourse={externalId:string;title:string;courseId:string|null};
type LocalCourse={id:string;name:string;evidenceKind?:string;active?:boolean};
const titleKey=(title:string)=>title.trim().replace(/\s+/g," ").toLowerCase();

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
