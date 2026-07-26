import { describe,expect,it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/sync/route";

describe("sync API rejection categories",()=>{
  it("rejects an unprovisioned browser before any database-authenticated sync work",async()=>{
    const response=await POST(new NextRequest("https://app.example/api/sync",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cursor:"0",events:[]})}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error:"This browser has not been provisioned as a kiosk device.",category:"DEVICE_UNPROVISIONED"});
  });
});
