import {expect,it,vi} from "vitest";
const people=[{id:"volunteer",firstName:"Example",lastName:"Volunteer",displayName:"Example Volunteer",jobRole:"Volunteer"},{id:"worker",firstName:"Example",lastName:"Worker",displayName:"Example Worker",jobRole:"Support Worker"}];
vi.mock("./prisma",()=>({prisma:{staffMember:{findMany:async({where}:{where:{id?:string}})=>where.id?people.filter(p=>p.id===where.id):people},trainingCourse:{findMany:async()=>[{id:"course",name:"Example course",requirementRules:{Volunteer:"REQUIRED","Support Worker":"REQUIRED"},evidenceKind:"THEORY",renewalMonths:12}]},staffTrainingRecord:{findMany:async()=>[]},staffTrainingAssignment:{findMany:async()=>[]},trainingExternalResult:{findMany:async()=>[]}}}));
import {trainingStatusData} from "./training-status-data";
it("excludes volunteers from team rows and mandatory totals",async()=>{
 const data=await trainingStatusData("organisation");
 expect(data.rows.map(row=>row.id)).toEqual(["worker"]);
 expect(data.counts.MISSING).toBe(1);
});
it("still provides an explicitly requested volunteer's own training information",async()=>{
 const data=await trainingStatusData("organisation","volunteer");
 expect(data.rows.map(row=>row.id)).toEqual(["volunteer"]);
 expect(data.rows[0].cells).toHaveLength(1);
});
