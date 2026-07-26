import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError } from "@/lib/api";
import { localDayBounds } from "@/lib/dates";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";

const query = z.object({ search:z.string().max(120).default(""), from:z.string().date().optional(), to:z.string().date().optional(), status:z.enum(["active","signed-out","all"]).default("active"), company:z.string().max(191).optional(), reasonId:z.uuid().optional(), reason:z.string().max(100).optional(), host:z.string().max(120).optional() });
export async function GET(req: NextRequest) {
  return withRole(req, "RECEPTION", async (user) => {
    const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return jsonError("Invalid visitor filters.", 422);
    const q={...parsed.data,...(user.role==="RECEPTION"?{status:"active" as const,from:undefined,to:undefined}:{})}, manager=user.role!=="RECEPTION";
    const visits = await prisma.visitorVisit.findMany({
      where: {
        ...(q.status==="active"?{signedOutAt:null}:q.status==="signed-out"?{signedOutAt:{not:null}}:{}),
        ...(q.from||q.to?{signedInAt:{...(q.from?{gte:localDayBounds(q.from).start}:{}),...(q.to?{lte:localDayBounds(q.to).end}:{})}}:{}),
        ...(q.company?{visitor:{company:{contains:q.company}}}:{}), ...(q.reasonId?{reasonId:q.reasonId}:{}), ...(q.reason?{reasonLabel:{contains:q.reason}}:{}), ...(q.host?{host:{contains:q.host}}:{}),
        ...(q.search?{OR:[{visitor:{fullName:{contains:q.search}}},{visitor:{company:{contains:q.search}}},{host:{contains:q.search}},{referenceCode:{contains:q.search}},...(manager?[{visitor:{mobile:{contains:q.search}}},{visitor:{email:{contains:q.search}}}]:[])]}:{}),
      },
      include:{visitor:true,reason:true,signInDevice:{select:{name:true}},signOutDevice:{select:{name:true}}}, orderBy:{signedInAt:"desc"}, take:manager?500:100,
    });
    if(manager && q.search) await audit("VISITOR_CONTACT_SEARCHED",{actorType:"USER",actorId:user.id,entityType:"VisitorVisit",afterValue:{resultCount:visits.length},...requestContext(req)});
    return NextResponse.json(visits.map((v)=>({id:v.id,referenceCode:v.referenceCode,fullName:v.visitor.fullName,company:v.visitor.company,host:v.host,reasonLabel:v.reasonLabel,otherReason:v.otherReason,vehicleRegistration:v.vehicleRegistration,signedInAt:v.signedInAt,signedOutAt:v.signedOutAt,device:v.signInDevice.name,emergencyIncluded:v.emergencyIncluded,anonymizedAt:v.anonymizedAt})));
  });
}