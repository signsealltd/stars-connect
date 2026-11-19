"use client";
import {openDB} from "idb";
import {mydayCanonicalJson,type MyDaySubmission} from "./myday-rules";
export type MyDayGrant={id:string;secret:string;expiresAt:string;publicKey:JsonWebKey};
type QueueItem={id:string;envelope:{key:string;iv:string;ciphertext:string};error?:string};
const queue=()=>openDB("stars-myday-protected",1,{upgrade(db){db.createObjectStore("queue",{keyPath:"id"});}});
const b64=(buffer:ArrayBuffer)=>{let s="";for(const b of new Uint8Array(buffer))s+=String.fromCharCode(b);return btoa(s);};
export async function enqueueMyday(submission:MyDaySubmission,grant:MyDayGrant){
 if(new Date(grant.expiresAt)<new Date())throw Error("Reconnect and enter your PIN before saving more offline updates.");
 const hmac=await crypto.subtle.importKey("raw",new TextEncoder().encode(grant.secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",hmac,new TextEncoder().encode(mydayCanonicalJson(submission))))).map(x=>x.toString(16).padStart(2,"0")).join("");
 const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt"]),iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new TextEncoder().encode(JSON.stringify({grantId:grant.id,secret:grant.secret,signature,submission}));
 const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,bytes),publicKey=await crypto.subtle.importKey("jwk",grant.publicKey,{name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
 const wrapped=await crypto.subtle.encrypt({name:"RSA-OAEP"},publicKey,await crypto.subtle.exportKey("raw",key));
 const db=await queue();await db.put("queue",{id:submission.requestKey,envelope:{key:b64(wrapped),iv:b64(iv.buffer),ciphertext:b64(ciphertext)}} satisfies QueueItem);db.close();
}
let syncing=false;
export async function syncMydayQueue(){
 if(syncing)return {pending:await mydayQueueCount(),review:0};syncing=true;let review=0;
 try{const db=await queue();for(const item of await db.getAll("queue") as QueueItem[]){try{const response=await fetch("/api/myday/sync",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(item.envelope)});const data=await response.json();if(response.ok&&(data.saved||data.review)){await db.delete("queue",item.id);if(data.review)review++;}else {item.error=data.error||"Waiting to sync";await db.put("queue",item);if(response.status>=500)break;}}catch{break;}}const pending=await db.count("queue");db.close();return {pending,review};}finally{syncing=false;}
}
export async function mydayQueueCount(){const db=await queue();const count=await db.count("queue");db.close();return count;}
export async function mydayQueueErrors(){const db=await queue();const rows=await db.getAll("queue") as QueueItem[];db.close();return rows.filter(r=>r.error).map(r=>r.error!);}
