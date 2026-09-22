import {vehicleDay} from "./vehicle-day";
import {db} from "./local-db";
import {CHECKLIST_VERSION,checklist,type Submission} from "./vehicle-checklist";
export type Vehicle={id:string;name:string;registration:string;fuelType:string;config:unknown;status:string;mileage:number;checks:Array<{id:string;outcome:string}>};
export type Draft={id:string;amendmentOf?:string;revision?:number;userId:string;staffName:string;vehicle:Vehicle;clientStartedAt:string;mileage:number;answers:Submission["answers"];images:Array<{id:string;blob:Blob}>;initialImageId:string;step:number;declaration:boolean;state:"DRAFT"|"PENDING"|"SYNCED";result?:string};
export async function saveLocal(key:string,value:unknown){const database=await db();await database.put("metadata",{key:`vehicle:${key}`,value});}
export async function loadLocal<T>(key:string){return (await (await db()).get("metadata",`vehicle:${key}`))?.value as T|undefined;}
export function newDraft(user:{id:string;name:string},vehicle:Vehicle):Draft{return {id:crypto.randomUUID(),userId:user.id,staffName:user.name,vehicle,clientStartedAt:new Date().toISOString(),mileage:vehicle.mileage,answers:checklist(vehicle.fuelType,vehicle.config).flatMap(s=>s.items).filter(i=>!i.applicable).map(i=>({key:i.key,response:"NA",notes:"",imageIds:[],secured:false})),images:[],initialImageId:"",step:0,declaration:false,state:"DRAFT"};}
export async function syncDraft(draft:Draft,apiBase="/api/fleet"){
 const identity=await fetch(`${apiBase}/vehicles`,{cache:"no-store"});if(!identity.ok||(await identity.json()).user?.id!==draft.userId)throw Error("Sign in as the account that started this check before syncing.");
 for(const image of draft.images){const form=new FormData();form.set("id",image.id);form.set("checkId",draft.id);form.set("file",image.blob,"vehicle.jpg");const r=await fetch(`${apiBase}/evidence`,{method:"POST",body:form});if(!r.ok)throw Error((await r.json()).error||"Photograph upload failed.");}
 const payload:Submission={...(draft.amendmentOf?{amendmentOf:draft.amendmentOf}:{}),id:draft.id,vehicleId:draft.vehicle.id,clientStartedAt:draft.clientStartedAt,mileage:draft.mileage,version:CHECKLIST_VERSION,initialImageId:draft.initialImageId,answers:draft.answers,declaration:true};
 const response=await fetch(`${apiBase}/checks`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error||"Sync failed. Your saved check is safe.");
 const synced:Draft={...draft,state:"SYNCED",result:result.outcome,revision:result.revision||1,images:[]};await saveLocal(`draft:${draft.userId}`,synced);await (await db()).delete("metadata",`vehicle:unfinished:${draft.userId}:${draft.id}`);return synced;
}
export async function preparePhoto(file:File):Promise<Blob>{
 if(!["image/jpeg","image/png"].includes(file.type)||file.size>10*1024*1024)throw Error("Choose a JPEG or PNG photograph under 10 MB.");
 const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});const ratio=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error("Unable to prepare photograph.")),"image/jpeg",0.88));
}
export type StoredVehicleCheck={id:string;userId:string;staffName:string;clientStartedAt:string;mileage:number;outcome:string;revision:number;snapshot:{initialImageId:string;answers:Array<Omit<Submission["answers"][number],"severity">&{severity?:"MINOR"|"CRITICAL"|null}>}};
export function draftFromCheck(check:StoredVehicleCheck,vehicle:Vehicle):Draft{return {id:check.id,userId:check.userId,staffName:check.staffName,vehicle,clientStartedAt:check.clientStartedAt,mileage:check.mileage,answers:check.snapshot.answers.map(a=>({...a,severity:a.severity||undefined})),images:[],initialImageId:check.snapshot.initialImageId,step:7,declaration:true,state:"SYNCED",result:check.outcome,revision:check.revision}}
export function amendDraft(draft:Draft,now=new Date()):Draft{if(draft.state!=="SYNCED"||vehicleDay(draft.clientStartedAt)!==vehicleDay(now))throw Error("Only today's submitted checks can be amended.");return {...draft,id:crypto.randomUUID(),amendmentOf:draft.id,vehicle:{...draft.vehicle,mileage:Math.min(draft.mileage,draft.vehicle.mileage)},images:[],step:0,declaration:false,state:"DRAFT",result:undefined}}
export async function rollDailyDraft(saved:Draft|undefined,vehicles:Vehicle[],now=new Date()):Promise<Draft|undefined>{
 if(!saved||vehicleDay(saved.clientStartedAt)===vehicleDay(now))return saved;
 if(saved.state!=="SYNCED")await saveLocal(`unfinished:${saved.userId}:${saved.id}`,saved);
 const vehicle=vehicles.find(v=>v.id===saved.vehicle.id);
 const fresh=vehicle?newDraft({id:saved.userId,name:saved.staffName},vehicle):undefined;
 if(fresh)fresh.clientStartedAt=now.toISOString();
 await saveLocal(`draft:${saved.userId}`,fresh||null);return fresh;
}
export async function unfinishedChecks(userId:string){return (await (await db()).getAll("metadata")).filter(r=>r.key.startsWith(`vehicle:unfinished:${userId}:`)&&r.value).map(r=>r.value as Draft).filter(d=>d.state!=="SYNCED")}
export async function latestDailyDraft(user:{id:string;name:string},vehicle:Vehicle,apiBase:string){const day=vehicleDay();const response=await fetch(`${apiBase}/checks?vehicle=${encodeURIComponent(vehicle.id)}&own=1&from=${day}&to=${day}`,{cache:"no-store"});const rows=await response.json();if(!response.ok)throw Error(rows.error||"Unable to load today's check.");return rows.length?draftFromCheck(rows[0],vehicle):newDraft(user,vehicle)}
