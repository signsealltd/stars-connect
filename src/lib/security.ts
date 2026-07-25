import{createHash,randomBytes,timingSafeEqual}from"crypto";import{cookies}from"next/headers";import{prisma}from"./prisma";import type{Role}from"@prisma/client";
export const sha256=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function createSession(userId:string){const token=randomBytes(32).toString("base64url");await prisma.session.create({data:{tokenHash:sha256(token),userId,expiresAt:new Date(Date.now()+8*60*60*1000)}});(await cookies()).set("pulse_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:8*60*60});return token}
export async function getSession(){const token=(await cookies()).get("pulse_session")?.value;if(!token)return null;return prisma.session.findFirst({where:{tokenHash:sha256(token),expiresAt:{gt:new Date()}},include:{user:true}})}
const rank:Record<Role,number>={RECEPTION:1,MANAGER:2,ADMINISTRATOR:3};
export async function requireRole(role:Role="RECEPTION"){const s=await getSession();if(!s||!s.user.active||rank[s.user.role]<rank[role])throw new Error("UNAUTHORISED");return s.user}
export function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
