import {NextRequest,NextResponse} from "next/server";
import bcrypt from "bcryptjs";
import {prisma} from "@/lib/prisma";
import {withRole,jsonError,requestContext} from "@/lib/api";
import {enforceAuditRetention} from "@/lib/audit-retention";

export async function GET(req:NextRequest){
  return withRole(req,"ADMINISTRATOR",async()=>{
    const [count,oldest,newest,sizeRows]=await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findFirst({orderBy:{createdAt:"asc"},select:{createdAt:true}}),
      prisma.auditLog.findFirst({orderBy:{createdAt:"desc"},select:{createdAt:true}}),
      prisma.$queryRaw<Array<{bytes:bigint|number|null}>>`SELECT SUM(data_length + index_length) AS bytes FROM information_schema.tables WHERE table_schema = DATABASE()`,
    ]);
    return NextResponse.json({auditCount:count,oldest:oldest?.createdAt||null,newest:newest?.createdAt||null,databaseBytes:Number(sizeRows[0]?.bytes||0)});
  });
}

export async function POST(req:NextRequest){
  return withRole(req,"ADMINISTRATOR",async actor=>{
    const body=await req.json().catch(()=>null),action=String(body?.action||"");
    if(action==="enforce-retention"){
      const result=await enforceAuditRetention();
      await prisma.auditLog.create({data:{action:"AUDIT_RETENTION_RUN",actorType:"USER",actorId:actor.id,entityType:"AuditLog",afterValue:{deleted:result.deleted,retentionDays:result.days},...requestContext(req)}});
      return NextResponse.json({...result,summary:`Retention applied. ${result.deleted} expired audit entries removed.`});
    }
    if(action==="purge-test-history"){
      if(!body?.password||!await bcrypt.compare(String(body.password),actor.passwordHash))return jsonError("Your administrator password was not accepted.",401);
      const count=await prisma.auditLog.count(),context=requestContext(req);
      await prisma.$transaction(async tx=>{
        await tx.auditLog.deleteMany();
        await tx.auditLog.create({data:{action:"TEST_AUDIT_HISTORY_PURGED",actorType:"USER",actorId:actor.id,entityType:"AuditLog",afterValue:{deleted:count,reason:"Pre-live test history removed by administrator"},...context}});
      });
      return NextResponse.json({deleted:count,summary:`Test audit history cleared. ${count} earlier entries removed; the purge marker was retained.`});
    }
    return jsonError("Unsupported maintenance action.",422);
  });
}
