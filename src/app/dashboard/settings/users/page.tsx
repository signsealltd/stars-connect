import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
import{Header}from"@/components/header";import{UserManager}from"@/components/user-manager";export const dynamic="force-dynamic";
export default async function UsersPage(){await requirePageCapability(CAPABILITIES.USERS_MANAGE);return <main className="shell"><Header manager/><div className="content"><UserManager/></div></main>}
