import {cookies} from "next/headers";
import {createHash} from "crypto";
import {prisma} from "./prisma";
import {CAPABILITIES} from "./permission-catalog";
export const DRIVER_COOKIE="stars_vehicle_driver";
export const driverKey=(token:string)=>"vehicleDriver:"+createHash("sha256").update(token).digest("hex");
export type DriverLink={userId:string;organisationId:string;name:string;enabled:boolean};
export async function driverFromToken(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await prisma.appSetting.findUnique({where:{key:driverKey(token)}});const link=row?.value as DriverLink|undefined;
 if(!link?.enabled||!link.userId||!link.organisationId)return null;
 const user=await prisma.user.findFirst({where:{id:link.userId,organisationId:link.organisationId,active:false,username:{startsWith:"driver."}}});if(!user)return null;
 return {...user,role:"CARE_ASSISTANT" as const,permissionOverrides:Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,c===CAPABILITIES.VEHICLE_CHECK]))};
}
export async function vehicleDriverSession(){const token=(await cookies()).get(DRIVER_COOKIE)?.value;return token?driverFromToken(token):null;}
