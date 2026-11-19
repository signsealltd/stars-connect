import {z} from "zod";

export const enjoymentLabels=["Didn't enjoy it","Didn't enjoy it","Didn't enjoy it much","Didn't enjoy it much","It was OK","It was OK","Enjoyed it","Enjoyed it","Really enjoyed it!","Really enjoyed it!"];
export const planSections={communication:"How I communicate",supportStrategies:"Support strategies that work",interests:"Interests and things I enjoy",dislikes:"Dislikes",triggers:"Things that may upset me",calmingStrategies:"What helps me feel calm",goals:"Current goals"} as const;
export const myDayDate=(value:Date|string=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
export const entryContentSchema=z.object({
 kind:z.enum(["GENERAL","ACTIVITY"]),text:z.string().trim().max(6000).default(""),activity:z.string().trim().max(191).default(""),
 participation:z.enum(["Took part","Watched by choice","Declined"]).optional(),alternative:z.string().trim().max(191).default(""),
 choice:z.enum(["Joined the alternative","Preferred a break","Declined alternatives","Other"]).optional(),choiceText:z.string().trim().max(1000).default(""),
 score:z.number().int().min(1).max(10).nullable().default(null),ratingMethod:z.enum(["Tapped by client","Entered by staff for client"]).nullable().default(null),handover:z.boolean().default(false),
}).strict().superRefine((v,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:"custom",message});
 if(v.kind==="GENERAL"){if(!v.text)fail("Write an update before saving.");if(v.score!==null||v.participation||v.activity||v.alternative||v.choice||v.choiceText||v.ratingMethod)fail("General updates do not have activity fields.");}
 else {if(!v.activity||!v.participation)fail("Choose or type an activity and participation.");if(v.participation==="Declined"){if(!v.alternative||!v.choice)fail("Record what else was offered and what the person chose.");if(v.choice==="Joined the alternative"&&v.alternative==="No alternative offered")fail("Choose the alternative they joined.");if(v.choice!=="Other"&&v.choiceText)fail("Remove the previous other-choice text before saving this choice.");if(v.choice==="Other"&&!v.choiceText)fail("Record their choice.");if(v.choice!=="Joined the alternative"&&v.score!==null)fail("Only rate an activity the client joined or watched.");}else if(v.alternative||v.choice||v.choiceText)fail("Alternative fields apply only when an activity was declined.");}
 if((v.score===null)!==(v.ratingMethod===null))fail("Record how the client communicated their rating.");
});
export const submissionSchema=z.object({requestKey:z.string().uuid(),id:z.string().uuid(),studentId:z.string().uuid(),occurredAt:z.string().datetime(),baseVersion:z.number().int().positive().optional(),content:entryContentSchema}).strict();
export type MyDayContent=z.infer<typeof entryContentSchema>;
export type MyDaySubmission=z.infer<typeof submissionSchema>;
export const reportContentSchema=z.object({opening:z.string().max(3000),activities:z.string().max(5000),enjoyment:z.string().max(3000),support:z.string().max(3000)}).strict();
export type MyDayReportContent=z.infer<typeof reportContentSchema>;
export function ratingActivity(content:MyDayContent){return content.participation==="Declined"&&content.choice==="Joined the alternative"?content.alternative:content.activity;}
export function identityDetails(medical:unknown,care:unknown){
 const m=(medical&&typeof medical==="object"?medical:{}) as Record<string,unknown>,c=(care&&typeof care==="object"?care:{}) as Record<string,unknown>;
 const text=(v:unknown)=>typeof v==="string"?v.trim():Array.isArray(v)?v.filter(x=>typeof x==="string").join(", "):"";
 // Only read explicit fields. Narrative health, notes and religion are never mined.
 return {allergies:/^(none|no known allergies|nka)$/i.test(text(m.allergies))?"No known allergies":text(m.allergies)||"not recorded",requirements:text(m.dietaryRequirements)||text(c.dietaryRequirements)||"not recorded",preferences:text(m.dietaryPreferences)||text(c.dietaryPreferences)||"not recorded",halal:m.halal===true||c.halal===true};
}

export function mydayCanonicalJson(value:unknown):string{if(value instanceof Date)return JSON.stringify(value.toISOString());if(Array.isArray(value))return `[${value.map(mydayCanonicalJson).join(",")}]`;if(value&&typeof value==="object")return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${mydayCanonicalJson(v)}`).join(",")}}`;return JSON.stringify(value);}

export type MyDayPlanNote={id:string;text:string;author:string;createdAt:string};
export function mydayPlanNotes(plan:Record<string,unknown>){const old=plan.additionalNotes,newer=Array.isArray(plan.mydayAdditionalNotes)?plan.mydayAdditionalNotes:[];const notes=[...newer,...(Array.isArray(old)?old:typeof old==="string"&&old.trim()?[{id:"legacy-note",text:old,author:"Author not recorded",createdAt:""}]:[])];return notes.filter((v):v is MyDayPlanNote=>!!v&&typeof v==="object"&&typeof v.text==="string").map((v,i)=>({id:v.id||`existing-${i}`,text:v.text,author:v.author||"Author not recorded",createdAt:v.createdAt||""}));}
