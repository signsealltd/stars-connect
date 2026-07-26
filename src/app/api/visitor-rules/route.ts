import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole,jsonError,requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
const schema=z.object({title:z.string().trim().min(3).max(150).refine(v=>!/[<>]/.test(v)),rulesText:z.string().trim().min(20).max(20000).refine(v=>!/<script/i.test(v))});
export async function GET(req:NextRequest){return withRole(req,"ADMINISTRATOR",async()=>NextResponse.json(await prisma.visitorRuleSet.findMany({orderBy:{version:"desc"}})))}
export async function POST(req:NextRequest){return withRole(req,"ADMINISTRATOR",async user=>{const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Site rules need a title and at least 20 characters.",422);const latest=await prisma.visitorRuleSet.findFirst({orderBy:{version:"desc"}});const rules=await prisma.$transaction(async tx=>{await tx.visitorRuleSet.updateMany({where:{active:true},data:{active:false}});return tx.visitorRuleSet.create({data:{...parsed.data,version:(latest?.version||0)+1,active:true,createdById:user.id}})});await audit("VISITOR_RULES_PUBLISHED",{actorType:"USER",actorId:user.id,entityType:"VisitorRuleSet",entityId:rules.id,afterValue:{version:rules.version,title:rules.title},...requestContext(req)});return NextResponse.json(rules);})}