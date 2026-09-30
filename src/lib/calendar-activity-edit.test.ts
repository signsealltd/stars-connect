import {beforeEach,describe,expect,it,vi} from "vitest";
import type {User} from "@prisma/client";
const db=vi.hoisted(()=>({$queryRaw:vi.fn(),operationOccurrence:{findFirst:vi.fn(),update:vi.fn()}}));
vi.mock("./prisma",()=>({prisma:{$transaction:async(fn:(tx:typeof db)=>unknown)=>fn(db)}}));
vi.mock("./compliance-service",()=>({requireOrganisation:()=>"organisation"}));
import {editCalendarActivity,editableActivity} from "./calendar-activity-edit";
const input={id:"activity",updatedAt:"2026-09-30T12:00:00.000Z",title:"Outing",type:"OUTING",date:"2026-09-30",startTime:"09:00",endTime:"11:00",staffIds:[],studentIds:[]};
describe("Calendar activity editing safeguards",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it.each(["ACTIVE","POST_OPERATION_REVIEW","COMPLETED","CANCELLED"])("protects %s activities",async status=>{expect(editableActivity(status)).toBe(false);db.operationOccurrence.findFirst.mockResolvedValue({updatedAt:new Date(input.updatedAt),status});await expect(editCalendarActivity({} as User,input)).rejects.toThrow("cannot be edited");expect(db.operationOccurrence.update).not.toHaveBeenCalled();});
 it("rejects stale edits before changing an activity",async()=>{db.operationOccurrence.findFirst.mockResolvedValue({updatedAt:new Date("2026-09-30T13:00:00Z"),status:"PLANNING"});await expect(editCalendarActivity({} as User,input)).rejects.toThrow("changed");expect(db.operationOccurrence.update).not.toHaveBeenCalled();});
 it("scopes lookup to the current organisation",async()=>{db.operationOccurrence.findFirst.mockResolvedValue(null);await expect(editCalendarActivity({} as User,input)).rejects.toThrow("not found");expect(db.operationOccurrence.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:"activity",organisationId:"organisation"}}));});
 it("allows planning and pre-start readiness revisions",()=>{for(const status of ["DRAFT","PLANNING","AWAITING_APPROVAL","READY"])expect(editableActivity(status)).toBe(true);});
});
