import {mkdir,writeFile,unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";

export const staffPrivateRoot=()=>path.resolve(process.env.STAFF_DOCUMENT_STORAGE_PATH||path.join(process.cwd(),".data","staff-private"));
export const staffDocumentExpiry=()=>new Date(Date.now()+Math.max(1,Math.min(3650,Number(process.env.STAFF_DOCUMENT_RETENTION_DAYS)||365))*86400000);
export async function writeStaffPrivateFile(bytes:Buffer) {
  const root=staffPrivateRoot();await mkdir(root,{recursive:true});const storagePath=path.join(root,randomUUID());
  await writeFile(storagePath,bytes,{flag:"wx",mode:0o600});return storagePath;
}
export async function removeStaffPrivateFile(storagePath:string) {
  if(!path.resolve(storagePath).startsWith(staffPrivateRoot()+path.sep))throw Error("Invalid private storage path");
  await unlink(storagePath).catch(error=>{if(error.code!=="ENOENT")throw error;});
}
