import { prisma } from "./prisma";

export async function auditRetentionDays(){
  const row=await prisma.appSetting.findUnique({where:{key:"auditRetentionDays"}});
  const value=Number(row?.value??365);
  return Math.min(3650,Math.max(30,Number.isFinite(value)?value:365));
}

export async function enforceAuditRetention(now=new Date()){
  const days=await auditRetentionDays();
  const cutoff=new Date(now.getTime()-days*86_400_000);
  const result=await prisma.auditLog.deleteMany({where:{createdAt:{lt:cutoff}}});
  return{deleted:result.count,days,cutoff};
}
