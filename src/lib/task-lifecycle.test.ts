import {describe,it,expect} from "vitest";
import {canChangeTask,nextTaskStatus} from "./task-lifecycle";
import {taskClosed} from "./task-queue";
const admin={role:"ADMINISTRATOR" as const,permissionOverrides:null};
describe("task lifecycle",()=>{
 it("completes, archives and restores shared ordinary records",()=>{expect(nextTaskStatus("operational","complete",{status:"OPEN"},"a")).toBe("COMPLETED");expect(nextTaskStatus("premises","archive",{status:"OPEN"},"a")).toBe("ARCHIVED");expect(nextTaskStatus("operational","reopen",{status:"ARCHIVED"},"a")).toBe("OPEN");expect(taskClosed("ARCHIVED")).toBe(true)});
 it("requires restoration before completing deleted records",()=>{expect(()=>nextTaskStatus("operational","complete",{status:"ARCHIVED"},"a")).toThrow(/Restore/)});
 it("does not bypass evidence through completion or reopen",()=>{for(const action of ["complete","reopen"] as const)expect(()=>nextTaskStatus("compliance",action,{status:"AWAITING_EVIDENCE"},"a")).toThrow()});
 it("requires a separate verifier",()=>{expect(nextTaskStatus("compliance","complete",{status:"OPEN",verificationRequired:true},"a")).toBe("AWAITING_VERIFICATION");expect(()=>nextTaskStatus("compliance","complete",{status:"AWAITING_VERIFICATION",verificationRequired:true,completedById:"a"},"a")).toThrow(/different/);expect(nextTaskStatus("compliance","complete",{status:"AWAITING_VERIFICATION",verificationRequired:true,completedById:"a"},"b")).toBe("COMPLETED")});
 it("preserves clinical and fleet workflows even for administrators",()=>{expect(canChangeTask(admin,"operational","medication:123")).toBe(false);expect(canChangeTask(admin,"operational","vehicle-unsafe:123")).toBe(false);expect(canChangeTask(admin,"operational")).toBe(true)});
 it("prevents repeated archive from overwriting restoration state",()=>{expect(()=>nextTaskStatus("compliance","archive",{status:"CANCELLED"},"a")).toThrow()});
});
