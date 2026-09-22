import {db} from "./local-db";
import {CHECKLIST_VERSION,checklist,type Submission} from "./vehicle-checklist";
export type Vehicle={id:string;name:string;registration:string;fuelType:string;config:unknown;status:string;mileage:number;checks:Array<{id:string;outcome:string}>};
export type Draft={id:string;userId:string;staffName:string;vehicle:Vehicle;clientStartedAt:string;mileage:number;answers:Submission["answers"];images:Array<{id:string;blob:Blob}>;initialImageId:string;step:number;declaration:boolean;state:"DRAFT"|"PENDING"|"SYNCED";result?:string};
export async function saveLocal(key:string,value:unknown){const database=await db();await database.put("metadata",{key:`vehicle:${key}`,value});}
export async function loadLocal<T>(key:string){return (await (await db()).get("metadata",`vehicle:${key}`))?.value as T|undefined;}
export function newDraft(user:{id:string;name:string},vehicle:Vehicle):Draft{return {id:crypto.randomUUID(),userId:user.id,staffName:user.name,vehicle,clientStartedAt:new Date().toISOString(),mileage:vehicle.mileage,answers:checklist(vehicle.fuelType,vehicle.config).flatMap(s=>s.items).filter(i=>!i.applicable).map(i=>({key:i.key,response:"NA",notes:"",imageIds:[],secured:false})),images:[],initialImageId:"",step:0,declaration:false,state:"DRAFT"};}
export async function syncDraft(draft:Draft,apiBase="/api/fleet"){
 const identity=await fetch(`${apiBase}/vehicles`,{cache:"no-store"});if(!identity.ok||(await identity.json()).user?.id!==draft.userId)throw Error("Sign in as the account that started this check before syncing.");
 for(const image of draft.images){const form=new FormData();form.set("id",image.id);form.set("checkId",draft.id);form.set("file",image.blob,"vehicle.jpg");const r=await fetch(`${apiBase}/evidence`,{method:"POST",body:form});if(!r.ok)throw Error((await r.json()).error||"Photograph upload failed.");}
 const payload:Submission={id:draft.id,vehicleId:draft.vehicle.id,clientStartedAt:draft.clientStartedAt,mileage:draft.mileage,version:CHECKLIST_VERSION,initialImageId:draft.initialImageId,answers:draft.answers,declaration:true};
 const response=await fetch(`${apiBase}/checks`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error||"Sync failed. Your saved check is safe.");
 const synced:Draft={...draft,state:"SYNCED",result:result.outcome,images:[]};await saveLocal(`draft:${draft.userId}`,synced);return synced;
}
export async function preparePhoto(file:File):Promise<Blob>{
 if(!["image/jpeg","image/png"].includes(file.type)||file.size>10*1024*1024)throw Error("Choose a JPEG or PNG photograph under 10 MB.");
 const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});const ratio=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error("Unable to prepare photograph.")),"image/jpeg",0.88));
}
