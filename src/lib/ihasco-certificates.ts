import {lookup} from "node:dns/promises";
import {request} from "node:https";
import {isIP} from "node:net";
import {IhascoError} from "./ihasco-client";

export function certificateUrl(value:string,base=process.env.IHASCO_CERTIFICATE_BASE_URL,hosts=(process.env.IHASCO_CERTIFICATE_ALLOWED_HOSTS||"").split(",").map(h=>h.trim().toLowerCase()).filter(Boolean)) {
  if(!/^[a-z][a-z0-9+.-]*:/i.test(value)&&!base)throw new IhascoError("CERT_BASE","Certificate links are relative. Configure IHASCO_CERTIFICATE_BASE_URL only after iHasco confirms the correct base URL for this account.");
  let url:URL;try{url=new URL(value,base);}catch{throw new IhascoError("CERT_URL","The certificate URL is invalid.");}
  if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443"||isIP(url.hostname)||!hosts.includes(url.hostname.toLowerCase()))throw new IhascoError("CERT_HOST","The certificate download host is not on the server's verified allowlist. Confirm the host with iHasco before allowing it.");
  return url;
}
export function publicCertificateAddress(address:string) {
  if(isIP(address)===4){const [a,b]=address.split(".").map(Number);return a!==0&&a!==10&&a!==127&&a!==169&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===168||b===0||b===2))&&!(a===100&&b>=64&&b<=127)&&a<224&&!(a===198&&(b===18||b===19||b===51))&&!(a===203&&b===0);}
  return isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address)&&!address.toLowerCase().startsWith("2001:db8:");
}
export function verifyCertificatePdf(bytes:Buffer,mime:string) {
  if(!/^application\/pdf(?:;|$)/i.test(mime)||bytes.subarray(0,5).toString()!=="%PDF-"||bytes.length>10*1024*1024)throw new IhascoError("CERT_TYPE","The certificate response is not a PDF under 10 MB. It may be an expired link or sign-in page; retry certificates to request a fresh link.");
}
export async function downloadCertificate(value:string) {
  let url=certificateUrl(value);
  for(let redirect=0;redirect<4;redirect++) {
    let addresses;try{addresses=await lookup(url.hostname,{all:true,verbatim:true});}catch{throw new IhascoError("CERT_NETWORK","The certificate download host could not be resolved. Retry certificates later.");}
    if(!addresses.length||addresses.some(a=>!publicCertificateAddress(a.address)))throw new IhascoError("CERT_HOST","The certificate download host resolved to a non-public address and was blocked.");
    const resolved=addresses[0];
    // Pin the validated DNS result. No API token, cookies or other credentials are sent.
    const result=await new Promise<{bytes:Buffer;mime:string;location?:string;status:number}>((resolve,reject)=>{
      const fail=()=>reject(new IhascoError("CERT_NETWORK","The certificate could not be downloaded. Retry certificates to obtain a fresh link."));
      const req=request(url,{headers:{Accept:"application/pdf"},signal:AbortSignal.timeout(30000),lookup:(_host,opts,cb)=>opts.all?cb(null,[resolved]):cb(null,resolved.address,resolved.family)},res=>{
        if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){res.resume();resolve({bytes:Buffer.alloc(0),mime:"",location:res.headers.location,status:res.statusCode});return;}
        if(res.statusCode!==200){res.resume();fail();return;}
        const chunks:Buffer[]=[];let size=0;
        res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>10*1024*1024){res.destroy();fail();}else chunks.push(chunk);});
        res.on("error",fail);res.on("end",()=>resolve({bytes:Buffer.concat(chunks),mime:String(res.headers["content-type"]||""),status:200}));
      });req.setTimeout(30000,()=>{req.destroy();fail();});req.on("error",fail);req.end();
    });
    if(result.status!==200){if(!result.location)break;url=certificateUrl(new URL(result.location,url).href);continue;}
    verifyCertificatePdf(result.bytes,result.mime);return result.bytes;
  }
  throw new IhascoError("CERT_REDIRECT","The certificate download exceeded the permitted redirect limit.");
}
