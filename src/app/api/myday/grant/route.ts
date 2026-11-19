import {cookies} from "next/headers";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {sha256} from "@/lib/security";
import {MYDAY_COOKIE,withMyday,mydayJson,issueMydayGrant} from "@/lib/myday-auth";
export async function POST(req:NextRequest){return withMyday(req,async actor=>{const token=(await cookies()).get(MYDAY_COOKIE)?.value,session=token?await prisma.myDaySession.findUnique({where:{tokenHash:sha256(token)}}):null;return mydayJson({grant:session&&session.staffId===actor.staffId?await issueMydayGrant(actor,session.credentialId,session.credentialHash):null});});}
