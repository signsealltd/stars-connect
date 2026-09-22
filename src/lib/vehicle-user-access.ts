import type {User} from "@prisma/client";
import {prisma} from "./prisma";
import {CAPABILITIES} from "./permission-catalog";
export const vehicleAccessKey=(userId:string)=>"vehicleCheckAccess:"+userId;
export async function applyVehicleUserAccess(user:User){
 const setting=user.role==="ADMINISTRATOR"?null:await prisma.appSetting.findUnique({where:{key:vehicleAccessKey(user.id)}});
 user.permissionOverrides={...(user.permissionOverrides as Record<string,boolean>||{}),[CAPABILITIES.VEHICLE_CHECK]:user.role==="ADMINISTRATOR"||setting?.value===true};
 return user;
}
