import {it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({scope:"VEHICLE",deleted:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>({value:"synthetic-token"})})}));
vi.mock("./prisma",()=>({prisma:{appSetting:{findUnique:async()=>({value:true})},session:{findFirst:async()=>({id:"session",scope:state.scope,lastSeenAt:new Date(),user:{id:"user",organisationId:"org",active:true}}),deleteMany:state.deleted},staffMember:{findUnique:async()=>({active:true})}}}));
import {getSession} from "./security";
it("does not grant manager sessions from vehicle PIN authentication",async()=>{expect(await getSession()).toBeNull();expect(state.deleted).not.toHaveBeenCalled();expect((await getSession(true))?.scope).toBe("VEHICLE")});
it("continues accepting full account sessions",async()=>{state.scope="FULL";expect((await getSession())?.scope).toBe("FULL")});
