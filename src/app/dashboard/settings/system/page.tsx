import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
import { Header } from "@/components/header";
import { LaunchCleanup } from "@/components/launch-cleanup";
import { SystemSettings } from "@/components/system-settings";
export const dynamic = "force-dynamic";
export default async function Page(){await requirePageCapability(CAPABILITIES.SYSTEM_VIEW);return <main className="shell"><Header manager/><div className="content"><h1 className="page-title">Version and backups</h1><p className="muted">Controlled deployment information and administrator-only database backups.</p><SystemSettings/><LaunchCleanup/></div></main>}