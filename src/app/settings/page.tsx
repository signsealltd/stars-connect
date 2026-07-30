import { Header } from "@/components/header";
import { SettingsClient } from "@/components/settings-client";
import { OrganisationSettingsForm } from "@/components/organisation-settings-form";
import { BillingSettings } from "@/components/billing-settings";
import { VisitorConfiguration } from "@/components/visitor-configuration";
import { requireRole } from "@/lib/security";
export default async function Settings(){await requireRole("ADMINISTRATOR");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Settings</h1><p className="muted">Administrator-only operational, retention and email configuration.</p></div></div><OrganisationSettingsForm/><section style={{marginBottom:22}}><div className="page-head"><div><h2>Invoice and payment details</h2><p className="muted">These details appear in the payment and document section of newly generated invoices.</p></div></div><BillingSettings/></section><SettingsClient/><VisitorConfiguration/></div></main>}
