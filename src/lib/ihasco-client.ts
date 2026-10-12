// Server-side only: imported by integration services and API routes, never UI modules.
import { z } from "zod";

export class IhascoError extends Error {
  constructor(public readonly code:string, message:string) {super(message);}
}
export const safeIhascoError=(error:unknown)=>error instanceof IhascoError?error.message:"The integration operation failed. Retry or ask an administrator to check the server configuration.";
const id=z.union([z.number().int().nonnegative(),z.string().regex(/^\d+$/)]).transform(String);
const providerDate=z.string().regex(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/).nullable();
export const ihUser=z.object({id,email:z.string().max(191).nullable(),first_name:z.string().max(191),last_name:z.string().max(191)});
export const ihCourse=z.object({course_id:id,title:z.string().min(1).max(191),pass_mark:z.number().nullable().optional(),refresh_months:z.number().nullable().optional()});
export const ihResult=z.object({id,user_id:id,course_id:id,completed_at:providerDate,expires_at:providerDate,test_score:z.number().nullable(),pass_mark:z.number().nullable(),test_attempts:z.number().int().nonnegative().nullable(),status_code:z.number().int(),archived_at:providerDate,updated_at:providerDate.optional(),certificate_link:z.object({url:z.string(),expires:z.string().optional()}).nullable().optional()});
export type IhResult=z.infer<typeof ihResult>;
export type IhUser=z.infer<typeof ihUser>;
export type IhCourse=z.infer<typeof ihCourse>;
export type IhCode={code:number;description:string};
const origin="https://api.ihasco.co.uk";
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export function apiUrl(path:string) {
  let url:URL;try{url=new URL(path,origin);}catch{throw new IhascoError("URL","iHasco returned an invalid pagination URL.");}
  if(url.origin!==origin||url.username||url.password||!/^\/(users|courses|results|meta\/codes)(?:\/|$)/.test(url.pathname)||[...url.searchParams.keys()].some(k=>/auth|token|key/i.test(k))) throw new IhascoError("URL","iHasco returned an unexpected API URL; no credentials were sent to it.");
  if(url.searchParams.has("fields")&&url.searchParams.get("fields")!=="certificate_link")throw new IhascoError("FIELDS","Unexpected API pagination fields were blocked.");
  return url;
}
export function readCodes(value:unknown):IhCode[] {
  const parsed=z.object({result_status:z.object({context:z.literal("result.status_code"),data:z.array(z.object({code:z.number().int(),description:z.string().min(1).max(191)}))})}).safeParse(value);
  if(!parsed.success||!parsed.data.result_status.data.length)throw new IhascoError("CODES","The /meta/codes result_status format is missing or differs from the documentation. No success statuses were assumed.");
  const codes=parsed.data.result_status.data;
  if(new Set(codes.map(c=>c.code)).size!==codes.length)throw new IhascoError("CODES","iHasco returned duplicate result status codes. Review the account metadata.");
  return codes;
}
export class IhascoClient {
  private nextRequestAt=0;
  constructor(private readonly key=process.env.IHASCO_API_KEY||"",private readonly transport:typeof fetch=fetch,private readonly sleep=wait,private readonly heartbeat:()=>Promise<void>=async()=>{}) {}
  async request(path:string):Promise<{data:unknown;pagination?:{next?:string|null}}> {
    if(!this.key)throw new IhascoError("CONFIG","IHASCO_API_KEY is not configured on the server.");
    const url=apiUrl(path);
    for(let attempt=0;attempt<4;attempt++) {
      await this.heartbeat();await this.sleep(Math.max(0,this.nextRequestAt-Date.now()));
      this.nextRequestAt=Date.now()+350; // Below the documented 200 requests/minute.
      let response:Response;
      try{response=await this.transport(url,{headers:{Authorization:`Bearer ${this.key}`,Accept:"application/vnd.ihasco.v2+json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000)});}
      catch{if(attempt<3){await this.sleep(1000*2**attempt);continue;}throw new IhascoError("NETWORK","iHasco could not be reached after retries. Local training evidence was retained.");}
      if(response.status===429||response.status>=500){
        const retry=response.headers.get("retry-after");const seconds=retry?Number(retry):NaN;
        const delay=retry?(Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-Date.now()):1000*2**attempt;
        await response.body?.cancel();
        if(attempt===3||delay>60000)throw new IhascoError("RETRY","iHasco is rate-limiting requests or temporarily unavailable. Retry later; the checkpoint was not advanced.");
        await this.heartbeat();await this.sleep(Math.max(1000,Number.isFinite(delay)?delay:1000));continue;
      }
      if(response.headers.get("x-ratelimit-remaining")==="0")this.nextRequestAt=Date.now()+60000;
      if(!response.ok){await response.body?.cancel();throw new IhascoError("HTTP",`iHasco returned HTTP ${response.status}. ${response.status===401||response.status===403?"Check the server API key and account API access.":"Check account access and the documented API request."}`);}
      let body:unknown;try{body=await response.json();}catch{throw new IhascoError("FORMAT","iHasco returned a non-JSON API response.");}
      const parsed=z.object({data:z.unknown(),pagination:z.object({next:z.string().nullable().optional()}).optional()}).safeParse(body);
      if(!parsed.success||parsed.data.data===undefined)throw new IhascoError("FORMAT","iHasco returned an unexpected response envelope.");
      return parsed.data;
    }
    throw new IhascoError("RETRY","iHasco retry limit reached.");
  }
  async list<T>(path:string,schema:z.ZodType<T>):Promise<T[]> {
    const rows:T[]=[];let next:string|null=path;const seen=new Set<string>();
    while(next){const nextUrl=apiUrl(next);if(nextUrl.pathname.replace(/\/$/,"")!==apiUrl(path).pathname.replace(/\/$/,""))throw new IhascoError("PAGINATION","iHasco pagination switched endpoints and was blocked.");const canonical=nextUrl.href;if(seen.has(canonical)||seen.size>=1000)throw new IhascoError("PAGINATION","iHasco pagination repeated or exceeded 100,000 rows; split the import or contact support.");seen.add(canonical);
      const body=await this.request(next);const parsed=z.array(schema).safeParse(body.data);
      if(!parsed.success)throw new IhascoError("FORMAT",`The iHasco ${apiUrl(path).pathname} response differs from the documented field types. ${parsed.error.issues.slice(0,5).map(issue=>`${issue.path.join(".")} (${issue.code})`).join(", ")}. No response values were logged.`);
      rows.push(...parsed.data);next=body.pagination?.next||null;
    }return rows;
  }
  async codes(){return readCodes((await this.request("/meta/codes")).data);}
  async result(id:string){const parsed=ihResult.safeParse((await this.request(`/results/${encodeURIComponent(id)}?fields=certificate_link`)).data);if(!parsed.success)throw new IhascoError("FORMAT","The individual result response differs from the documented format.");return parsed.data;}
}
