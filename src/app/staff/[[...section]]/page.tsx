import {StaffArea} from "@/components/staff-area";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section}=await params;return <StaffArea section={section?.[0]||"home"}/>}
