import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error("DATABASE_URL is not configured.");
const url=new URL(databaseUrl),directory=path.resolve(process.env.DATABASE_BACKUP_PATH||path.join(process.cwd(),"storage","backups"));await mkdir(directory,{recursive:true});
const stamp=new Date().toISOString().replace(/[-:]/g,"").replace("T","-").slice(0,15),target=path.join(directory,`stars-connect-${stamp}.sql`),binary=process.env.MARIADB_DUMP_PATH||"mariadb-dump";
const args=["--single-transaction","--routines","--triggers","--events","--default-character-set=utf8mb4",`--host=${url.hostname}`,`--port=${url.port||"3306"}`,`--user=${decodeURIComponent(url.username)}`,`--result-file=${target}`,decodeURIComponent(url.pathname.replace(/^\//,""))];
await new Promise((resolve,reject)=>{const child=spawn(binary,args,{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio:["ignore","inherit","inherit"]});child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error(`mariadb-dump exited with code ${code}`)))});const info=await stat(target);console.log(`Backup created: ${target} (${info.size} bytes)`);