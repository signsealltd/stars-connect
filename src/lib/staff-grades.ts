import type {Role} from "@prisma/client";
export const STAFF_GRADES=["Administrator","Assistant Manager","Manager","Team Leader","Support Worker"] as const;
export type StaffGrade=typeof STAFF_GRADES[number];
export const STAFF_GRADE_ROLES={Administrator:"ADMINISTRATOR","Assistant Manager":"MANAGER",Manager:"MANAGER","Team Leader":"TEAM_LEADER","Support Worker":"CARE_ASSISTANT"} as const satisfies Record<StaffGrade,Role>;
export function staffGrade(value:string):StaffGrade|undefined{const normal=value.trim().toLowerCase().replaceAll('_',' ');if(normal==='care assistant')return 'Support Worker';return STAFF_GRADES.find(g=>g.toLowerCase()===normal)}
