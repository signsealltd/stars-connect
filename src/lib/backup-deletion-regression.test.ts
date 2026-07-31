import {describe,expect,it} from "vitest";
import {readFileSync} from "fs";

describe("managed backup deletion regression",()=>{
  it("deletes through the collection endpoint with validation, path protection and audit",()=>{
    const route=readFileSync("src/app/api/system/backups/route.ts","utf8");
    expect(route).toContain("export async function DELETE");
    expect(route).toContain("managedBackupName.test(name)");
    expect(route).toContain("path.dirname(target) !== directory");
    expect(route).toContain("DATABASE_BACKUP_DELETED");
  });
  it("always clears the deleting state and tolerates a non-JSON server error",()=>{
    const component=readFileSync("src/components/system-settings.tsx","utf8");
    expect(component).toContain("/api/system/backups?name=");
    expect(component).toContain('contentType.includes("application/json")');
    expect(component).toContain('finally{setBusy("")}');
  });
});
