import Link from "next/link";
import { ShieldX } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const session = await getSession();
  if (!session || !session.user.active) redirect("/login");

  return <main className="shell">
    <Header manager />
    <div className="content">
      <section className="card empty" style={{maxWidth:680,margin:"64px auto",padding:40}}>
        <ShieldX size={48} aria-hidden="true" />
        <h1>Access restricted</h1>
        <p>You are signed in as {session.user.name}, but this account does not have permission to open this section.</p>
        <p className="muted">Ask an administrator to review your individual permissions if you need access.</p>
        <Link className="btn primary" href="/dashboard">Return to dashboard</Link>
      </section>
    </div>
  </main>;
}
