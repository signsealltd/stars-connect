import {NextRequest} from "next/server";
import {createHmac,timingSafeEqual} from "crypto";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {sha256} from "@/lib/security";
import {mutationOriginAllowed,requestContext} from "@/lib/api";
import {rateLimit} from "@/lib/rate-limit";
import {decryptMydayEnvelope,mydayEnabled,mydayJson,mydayOrganisation,staffStillAllowed,MyDayError} from "@/lib/myday-auth";
import {mydayCanonicalJson,submissionSchema} from "@/lib/myday-rules";
import {saveMydayEntry} from "@/lib/myday-service";
const schema=z.object({key:z.string().max(1000),iv:z.string().max(100),ciphertext:z.string().max(100000)}).strict();
export async function POST(req:NextRequest){
 try{
  if(!mutationOriginAllowed(req))return mydayJson({error:"Request origin rejected."},403);
  if(!await mydayEnabled())return mydayJson({error:"My Day is switched off. Your queued update remains on this tablet."},503);
  if(!rateLimit(`myday-sync:${requestContext(req).ipAddress||"shared"}`,120,60_000).allowed)return mydayJson({error:"Waiting to retry sync."},429);
  const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return mydayJson({error:"Invalid protected submission."},422);
  const opened=await decryptMydayEnvelope(parsed.data),inner=z.object({grantId:z.string().uuid(),secret:z.string().max(100),signature:z.string().regex(/^[a-f0-9]{64}$/),submission:submissionSchema}).strict().safeParse(opened);
  if(!inner.success)return mydayJson({error:"Invalid protected update."},422);
  const {grantId,secret,signature,submission}=inner.data,grant=await prisma.myDayGrant.findUnique({where:{id:grantId}});
  if(!grant||sha256(secret)!==grant.secretHash||grant.organisationId!==await mydayOrganisation())return mydayJson({error:"This queued update's authorisation could not be verified. Keep it on this tablet and ask an administrator."},403);
  const expected=createHmac("sha256",secret).update(mydayCanonicalJson(submission)).digest();if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))return mydayJson({error:"Queued update integrity check failed."},422);
  const replay=await prisma.myDayRevision.findUnique({where:{requestKey:submission.requestKey}});if(replay){if(replay.actorId!==grant.staffId||mydayCanonicalJson(replay.content)!==mydayCanonicalJson(submission))return mydayJson({error:"Request already used with different details."},409);return mydayJson({saved:true});}
  const staff=await staffStillAllowed(grant.staffId,grant.credentialId,grant.credentialHash),original=await prisma.staffMember.findUnique({where:{id:grant.staffId}});
  if(!original)return mydayJson({error:"Original author unavailable; ask an administrator."},403);
  const actor={id:grant.staffId,staffId:grant.staffId,name:original.displayName,organisationId:grant.organisationId,admin:false};
  const client=await prisma.student.findUnique({where:{id:submission.studentId},select:{active:true,archivedAt:true}});
  const hidden=!client?.active||!!client.archivedAt||(await prisma.myDayClient.findUnique({where:{studentId:submission.studentId}}))?.hidden;
  if(!staff||grant.expiresAt<new Date()||hidden){await prisma.myDayReview.upsert({where:{id:submission.requestKey},update:{},create:{id:submission.requestKey,organisationId:grant.organisationId,staffId:grant.staffId,reason:hidden?"CLIENT_HIDDEN":!staff?"AUTHOR_ACCESS_REVOKED":"OFFLINE_AUTHORISATION_EXPIRED",payload:JSON.parse(JSON.stringify({submission,actor}))}});return mydayJson({review:true});}
  return mydayJson(await saveMydayEntry(actor,submission));
 }catch(e){if(e instanceof MyDayError)return mydayJson({error:e.message},e.status);return mydayJson({error:"Sync is waiting. The protected update remains on this tablet; retry when connected."},503);}
}
