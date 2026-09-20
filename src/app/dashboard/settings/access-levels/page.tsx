import {Header} from "@/components/header";
import {AccessLevelManager} from "@/components/access-level-manager";
import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.USERS_MANAGE);return <main className="shell"><Header manager/><div className="content"><h1>Access Levels</h1><AccessLevelManager/></div></main>}
