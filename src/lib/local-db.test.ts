import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPulledBatch, applyPulledEvent, clearUnprovisionedQueue, db, inspectUnprovisionedQueue, queueChange, saveAttendance, syncNow } from "./local-db";

const storage = new Map<string,string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key:string) => storage.get(key) ?? null,
  setItem: (key:string,value:string) => storage.set(key,value),
  removeItem: (key:string) => storage.delete(key),
} });

const clockEvent = (sequence="1") => ({
  sequence,eventId:"11111111-1111-4111-8111-111111111111",operation:"CLOCK_EVENT" as const,
  payload:{staffId:"staff-1",staffName:"Amelia Hart",type:"CLOCK_IN",deviceId:"device-a",deviceTimestamp:"2026-07-20T08:30:00Z",offlineRecorded:false,photoStatus:"NOT_REQUIRED"},
  createdAt:"2026-07-20T08:30:01Z",
});

beforeEach(async()=>{
  storage.clear();
  const database=await db();
  for(const store of ["staff","attendance","clockEvents","pending","metadata","rollCalls","appliedEvents","conflicts","visitorVisits"] as const)await database.clear(store);
});

afterEach(() => vi.unstubAllGlobals());

describe("pulled event application",()=>{
  it("applies a Tablet A clock event to Tablet B local state",async()=>{
    const database=await db();
    expect(await applyPulledEvent(database,clockEvent())).toBe("applied");
    expect((await database.get("staff","staff-1"))?.currentState).toBe("IN");
  });

  it("moves a clocked-in staff member offsite and back onsite without closing the shift",async()=>{
    const database=await db();
    await applyPulledEvent(database,clockEvent());
    await applyPulledEvent(database,{sequence:"2",eventId:"33333333-3333-4333-8333-333333333333",operation:"STAFF_PRESENCE",payload:{staffId:"staff-1",staffName:"Amelia Hart",type:"WENT_OFFSITE",deviceId:"device-a",deviceTimestamp:"2026-07-20T10:00:00Z",offlineRecorded:false},createdAt:"2026-07-20T10:00:01Z"});
    expect((await database.get("staff","staff-1"))?.currentState).toBe("OFFSITE");
    expect(await database.count("clockEvents")).toBe(1);
    await applyPulledEvent(database,{sequence:"3",eventId:"44444444-4444-4444-8444-444444444444",operation:"STAFF_PRESENCE",payload:{staffId:"staff-1",staffName:"Amelia Hart",type:"RETURNED_ONSITE",deviceId:"device-a",deviceTimestamp:"2026-07-20T11:00:00Z",offlineRecorded:false},createdAt:"2026-07-20T11:00:01Z"});
    expect((await database.get("staff","staff-1"))?.currentState).toBe("IN");
    expect(await database.count("clockEvents")).toBe(1);
  });
  it("does not apply a pulled UUID twice",async()=>{
    const database=await db();
    await applyPulledEvent(database,clockEvent());
    expect(await applyPulledEvent(database,clockEvent())).toBe("duplicate");
    expect(await database.count("clockEvents")).toBe(1);
  });

  it("persists the cursor after each successfully applied event",async()=>{
    await applyPulledBatch([clockEvent("42")]);
    expect(localStorage.getItem("pulse-sync-cursor")).toBe("42");
    expect((await (await db()).get("metadata","syncCursor"))?.value).toBe("42");
  });

  it("keeps a newer local attendance version and records a conflict",async()=>{
    const database=await db();
    await database.put("attendance",{id:"local",studentId:"student-1",date:"2026-07-20",status:"PRESENT",deviceTimestamp:"2026-07-20T09:00:00Z",version:3});
    await applyPulledEvent(database,{sequence:"2",eventId:"22222222-2222-4222-8222-222222222222",operation:"ATTENDANCE",payload:{studentId:"student-1",date:"2026-07-20",status:"ABSENT",deviceTimestamp:"2026-07-20T08:00:00Z",version:2},createdAt:"2026-07-20T08:00:01Z"});
    expect((await database.get("attendance","local"))?.status).toBe("PRESENT");
    expect(await database.count("conflicts")).toBe(1);
  });
});

describe("visitor offline synchronisation",()=>{
  const signIn={sequence:"50",eventId:"55555555-5555-4555-8555-555555555555",operation:"VISITOR_SIGN_IN" as const,payload:{id:"55555555-5555-4555-8555-555555555555",visitorId:"66666666-6666-4666-8666-666666666666",referenceCode:"VIS12345",fullName:"Jamie Visitor",company:"Example Ltd",host:"Morgan Manager",reasonLabel:"Meeting",signedInAt:"2026-07-26T09:00:00Z",emergencyIncluded:true},createdAt:"2026-07-26T09:00:01Z"};
  it("applies a Tablet A visitor sign-in to Tablet B exactly once",async()=>{const database=await db();expect(await applyPulledEvent(database,signIn)).toBe("applied");expect(await applyPulledEvent(database,signIn)).toBe("duplicate");expect((await database.get("visitorVisits",signIn.eventId))?.fullName).toBe("Jamie Visitor")});
  it("applies a pulled visitor sign-out",async()=>{const database=await db();await applyPulledEvent(database,signIn);await applyPulledEvent(database,{sequence:"51",eventId:"77777777-7777-4777-8777-777777777777",operation:"VISITOR_SIGN_OUT",payload:{visitId:signIn.eventId,signedOutAt:"2026-07-26T10:00:00Z"},createdAt:"2026-07-26T10:00:01Z"});expect((await database.get("visitorVisits",signIn.eventId))?.signedOutAt).toBe("2026-07-26T10:00:00Z")});
  it("keeps active visitors available for the offline emergency register",async()=>{const database=await db();await applyPulledEvent(database,signIn);const active=(await database.getAll("visitorVisits")).filter(v=>!v.signedOutAt&&v.emergencyIncluded);expect(active.map(v=>v.fullName)).toEqual(["Jamie Visitor"])});
});
describe("unprovisioned desktop queue safety",()=>{
  it("allows stale queue inspection and explicit clearing only while unprovisioned",async()=>{
    const database=await db();
    await database.put("pending",{id:"stale-1",operation:"ATTENDANCE",payload:{},createdAt:"2026-07-20T08:00:00Z",attempts:1});
    expect((await inspectUnprovisionedQueue()).items).toEqual([{id:"stale-1",operation:"ATTENDANCE",createdAt:"2026-07-20T08:00:00Z",attempts:1}]);
    await clearUnprovisionedQueue();
    expect(await database.count("pending")).toBe(0);
  });
  it("protects legitimate queues after device provisioning",async()=>{
    localStorage.setItem("pulse-device-id","tablet-1");localStorage.setItem("pulse-device-token","secret");
    await expect(clearUnprovisionedQueue()).rejects.toThrow("PROVISIONED_QUEUE_PROTECTED");
  });
});
describe("register synchronisation",()=>{
  it("queues every edit as a distinct sync event while retaining the attendance record identity",async()=>{
    localStorage.setItem("pulse-device-id","tablet-1");
    localStorage.setItem("pulse-device-token","secret");
    const base={id:"daily-attendance-1",studentId:"student-1",date:"2026-07-26",arrivalTime:"2026-07-26T08:30:00Z",deviceTimestamp:"2026-07-26T08:30:00Z"};
    await saveAttendance({...base,status:"PRESENT" as const,version:1});
    await saveAttendance({...base,status:"OFFSITE" as const,departureTime:"2026-07-26T12:00:00Z",deviceTimestamp:"2026-07-26T12:00:00Z",version:2});
    const pending=await (await db()).getAll("pending");
    expect(pending).toHaveLength(2);
    expect(new Set(pending.map(event=>event.id)).size).toBe(2);
    expect(pending.every(event=>(event.payload as {id:string}).id===base.id)).toBe(true);
  });
  it("runs another upload when attendance is queued during an active sync",async()=>{
    localStorage.setItem("pulse-device-id","tablet-1");
    localStorage.setItem("pulse-device-token","secret");
    vi.stubGlobal("window",{location:{pathname:"/register"},dispatchEvent:()=>undefined});
    vi.stubGlobal("navigator",{onLine:true});
    vi.stubGlobal("CustomEvent",class{});
    let releaseFirst!:()=>void;
    const firstGate=new Promise<void>(resolve=>{releaseFirst=resolve});
    const response=(init?:RequestInit)=>({
      ok:true,
      json:async()=>{
        const body=JSON.parse(String(init?.body));
        return{acknowledged:body.events.map((event:{id:string})=>event.id),events:[],cursor:body.cursor};
      },
    });
    const fetchMock=vi.fn()
      .mockImplementationOnce(async(_url:string,init?:RequestInit)=>{await firstGate;return response(init)})
      .mockImplementation(async(_url:string,init?:RequestInit)=>response(init));
    vi.stubGlobal("fetch",fetchMock);
    await queueChange({id:"attendance-1",operation:"ATTENDANCE",payload:{},createdAt:new Date().toISOString(),attempts:0});
    const firstSync=syncNow();
    await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1));
    await queueChange({id:"attendance-2",operation:"ATTENDANCE",payload:{},createdAt:new Date().toISOString(),attempts:0});
    syncNow();
    releaseFirst();
    await firstSync;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await (await db()).count("pending")).toBe(0);
  });
});
