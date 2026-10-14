import {NextRequest} from 'next/server';
import {withStaff,staffJson} from '@/lib/staff-area-auth';
import {printableFile} from '@/lib/printable-library';
import {RequestError} from '@/lib/request-error';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withStaff(req,async i=>{try{return await printableFile(i.user,(await params).id,true,req.nextUrl.searchParams.get('version'),req.nextUrl.searchParams.has('download'))}catch(e){if(e instanceof RequestError)return staffJson({error:e.message},e.status);throw e}})}
