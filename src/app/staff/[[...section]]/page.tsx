import {StaffArea} from "@/components/staff-area";
import {prisma} from "@/lib/prisma";
import type {Metadata} from "next";
export const dynamic="force-dynamic";
type Props={params:Promise<{section?:string[]}>,searchParams:Promise<{member?:string}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{const {member}=await searchParams;return {title:{absolute:"STARS Staff"},manifest:"/staff/app.webmanifest"+(/^[a-f0-9]{64}$/.test(member||"")?"?member="+member:"")}}
export default async function Page({params,searchParams}:Props){const {section}=await params;const {member}=await searchParams;const account=member&&/^[a-f0-9]{64}$/.test(member)?await prisma.staffPortalAccount.findFirst({where:{loginLink:member,enabled:true,staff:{active:true,archivedAt:null}},select:{staff:{select:{firstName:true}}}}):null;return <StaffArea section={section?.[0]||"home"} personalLink={account?member:undefined} personalName={account?.staff.firstName}/>}
