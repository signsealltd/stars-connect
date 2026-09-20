import type {User} from "@prisma/client";
import {CAPABILITIES,hasCapability,type Capability} from "./permission-catalog";
export const resourceCategories={POLICY:CAPABILITIES.STAFF_POLICIES,RIDDOR:CAPABILITIES.STAFF_RIDDOR,SDS:CAPABILITIES.STAFF_SDS,RAMS:CAPABILITIES.STAFF_RAMS} as const;
export function canReadResource(user:User,resource:{category:string;studentId:string|null;status:string}) {
 const cap=resourceCategories[resource.category as keyof typeof resourceCategories] as Capability|undefined;
 return !!cap&&hasCapability(user.role,cap,user.permissionOverrides)&&(!resource.studentId||hasCapability(user.role,CAPABILITIES.STUDENT_CARE,user.permissionOverrides))&&(resource.status==="PUBLISHED"||hasCapability(user.role,CAPABILITIES.STAFF_RESOURCES_MANAGE,user.permissionOverrides));
}
