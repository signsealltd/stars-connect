import { Header } from "@/components/header";
import { SettingsClient } from "@/components/settings-client";
import { VisitorConfiguration } from "@/components/visitor-configuration";
import { requireRole } from "@/lib/security";
export default async function Settings(){await requireRole("ADMINISTRATOR");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Settings</h1><p className="muted">Administrator-only operational, retention and email configuration.</p></div></div><SettingsClient/><VisitorConfiguration/></div></main>}
