import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {ihConfigurationReady,ihIntegration,ihStatus,ihTest,ihPreview,ihMap,ihSync,ihConfirmCourseProposal} from "@/lib/ihasco-service";
import {RequestError} from "@/lib/request-error";
import {safeIhascoError} from "@/lib/ihasco-client";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.enum(["test","preview","sync","retry-certificates"])}),
  z.object({action:z.literal("import"),previewToken:z.string().uuid()}),
  z.object({action:z.literal("confirm-course-proposal"),token:z.string().regex(/^[a-f0-9]{64}$/)}),
  z.object({action:z.literal("map"),kind:z.enum(["staff","course","statuses"]),externalId:z.string().regex(/^\d+$/).optional(),targetId:z.string().uuid().nullable().optional(),codes:z.array(z.number().int()).max(100).optional()}),
]);
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.TRAINING_MANAGE,async user=>{
  if(!ihConfigurationReady())return NextResponse.json({configured:false,keyConfigured:!!process.env.IHASCO_API_KEY},{headers:{"Cache-Control":"no-store"}});
  if(!user.organisationId)return jsonError("Organisation membership is required.",403);
  return NextResponse.json(await ihStatus(await ihIntegration(user.organisationId)),{headers:{"Cache-Control":"private, no-store"}});
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.TRAINING_MANAGE,async user=>{
  const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the iHasco action details.",422);
  if(!user.organisationId)return jsonError("Organisation membership is required.",403);
  const integration=await ihIntegration(user.organisationId),v=parsed.data;
  try{
    if(v.action==="test")return NextResponse.json(await ihTest(integration,user.id));
    if(v.action==="preview")return NextResponse.json(await ihPreview(integration,user.id));
    if(v.action==="map"){await ihMap(integration,v,user.id);return NextResponse.json({ok:true});}
    if(v.action==="confirm-course-proposal")return NextResponse.json(await ihConfirmCourseProposal(integration,v.token,user.id));
    if(!integration.activatedAt&&v.action!=="import")return jsonError("Review the initial preview before importing results or starting sync.",409);
    return NextResponse.json(await ihSync(integration,{actorId:user.id,previewToken:v.action==="import"?v.previewToken:undefined,certificatesOnly:v.action==="retry-certificates"}));
  }catch(error){return jsonError(error instanceof RequestError?error.message:safeIhascoError(error),error instanceof RequestError?error.status:502);}
});}
