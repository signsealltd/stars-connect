import type {User,StaffRequest} from "@prisma/client";
import {CAPABILITIES,hasCapability} from "./permission-catalog";
import {requestReviewAllowed} from "./staff-area-input";
export function canReviewStaffRequest(user:User,r:Pick<StaffRequest,"type"|"organisationId"|"involvedUserIds"|"details">){
 if(user.organisationId!==r.organisationId)return false;
 const blocked=Array.isArray(r.involvedUserIds)?r.involvedUserIds.filter((v):v is string=>typeof v==="string"):[];
 // Also fail closed when the reviewer is named in free text, even if the author omitted the selector.
 const details=r.details as Record<string,unknown>;if(r.type==="PROFILE"&&details.hr&&(details.proposed as Record<string,unknown>)?.medical&&!hasCapability(user.role,CAPABILITIES.STAFF_MEDICAL_VIEW,user.permissionOverrides))return false;const people=String(details.peopleInvolved||"").toLowerCase();
 if(r.type==="CONCERN"&&[user.name,user.email,user.username].some(n=>n&&people.includes(n.toLowerCase())))return false;
 return requestReviewAllowed(r.type,Object.values(CAPABILITIES).filter(c=>hasCapability(user.role,c,user.permissionOverrides)),user.id,blocked);
}
