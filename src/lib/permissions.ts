import type {User} from "@prisma/client";
import {redirect} from "next/navigation";
import {AccessError,getSession} from "./security";
import {hasCapability,type Capability} from "./permission-catalog";
export * from "./permission-catalog";
export async function requireCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session)throw new AccessError(401,"AUTHENTICATION_REQUIRED");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))throw new AccessError(403,"FORBIDDEN");return session.user;}
export async function requirePageCapability(capability:Capability):Promise<User>{const session=await getSession();if(!session||!session.user.active)redirect("/login");if(!hasCapability(session.user.role,capability,session.user.permissionOverrides))redirect(`/access-denied?from=${encodeURIComponent(capability)}`);return session.user;}
