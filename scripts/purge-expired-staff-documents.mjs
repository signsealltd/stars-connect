// Run as a scheduled maintenance job. Preview by default; --apply removes expired files.
import {PrismaClient} from '@prisma/client';
import {unlink} from 'node:fs/promises';
import path from 'node:path';
const prisma=new PrismaClient();
const root=path.resolve(process.env.STAFF_DOCUMENT_STORAGE_PATH||path.join(process.cwd(),'.data','staff-private'));
try{
 const documents=await prisma.staffPrivateDocument.findMany({where:{expiresAt:{lt:new Date()}},take:500});
 console.log(`${documents.length} expired private documents ${process.argv.includes('--apply')?'will be removed':'found (preview only)'}.`);
 if(process.argv.includes('--apply'))for(const d of documents){
  const target=path.resolve(d.storagePath);if(!target.startsWith(root+path.sep))throw Error('Private storage boundary rejected');
  try{await unlink(target)}catch(e){if(e.code!=='ENOENT')throw e}
  await prisma.$transaction(async tx=>{if(d.requestId)await tx.staffRequestEvent.create({data:{requestId:d.requestId,actorId:'00000000-0000-0000-0000-000000000000',action:'DOCUMENT_EXPIRED',message:'Supporting document removed under retention policy',staffVisible:false}});await tx.staffPrivateDocument.delete({where:{id:d.id}})});
 }
}finally{await prisma.$disconnect()}
