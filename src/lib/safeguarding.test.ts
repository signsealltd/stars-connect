import {describe,it,expect} from "vitest";
import {qualifyingAbsences} from "./safeguarding";
const records=[1,2,3].map(n=>({id:String(n),date:new Date(`2026-09-0${n}`),status:"ABSENT"}));
const policy={mode:"ACCUMULATED" as const,windowDays:0},now=new Date("2026-09-20");
describe("three-absence safeguarding trigger",()=>{
 it("triggers on the third confirmed absence, not before",()=>{expect(qualifyingAbsences(records.slice(0,2),new Set(),policy,now)).toHaveLength(0);expect(qualifyingAbsences(records,new Set(),policy,now)).toHaveLength(3)});
 it("does not reopen a closed episode but permits three later absences",()=>{const consumed=new Set(records.map(r=>r.id));expect(qualifyingAbsences(records,consumed,policy,now)).toHaveLength(0);const later=[4,5,6].map(n=>({id:String(n),date:new Date(`2026-09-0${n}`),status:"ABSENT"}));expect(qualifyingAbsences([...records,...later],consumed,policy,now)).toEqual(later)});
 it("does not count an unmarked or future register entry",()=>{expect(qualifyingAbsences([...records.slice(0,2),{id:"4",date:new Date("2026-09-04"),status:"NOT_MARKED"},{id:"future",date:new Date("2026-10-01"),status:"ABSENT"}],new Set(),policy,now)).toHaveLength(0)});
 it("supports a consecutive counting policy and a bounded window",()=>{const withPresence=[...records,{id:"present",date:new Date("2026-09-04"),status:"PRESENT"}];expect(qualifyingAbsences(withPresence,new Set(),{mode:"CONSECUTIVE",windowDays:0},now)).toHaveLength(0);expect(qualifyingAbsences(records,new Set(),{...policy,windowDays:7},now)).toHaveLength(0)});
});
