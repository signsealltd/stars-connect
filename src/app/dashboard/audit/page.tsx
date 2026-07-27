import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/security";

export const dynamic = "force-dynamic";

function clientName(userAgent?: string | null) {
  if (!userAgent) return "Browser not recorded";
  const os = /Android/i.test(userAgent) ? "Android" : /iPhone|iPad/i.test(userAgent) ? "iOS/iPadOS" : /Windows/i.test(userAgent) ? "Windows" : /Mac OS/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : "Unknown OS";
  const browser = /Edg\//i.test(userAgent) ? "Edge" : /OPR\//i.test(userAgent) ? "Opera" : /Chrome\//i.test(userAgent) ? "Chrome" : /Safari\//i.test(userAgent) ? "Safari" : /Firefox\//i.test(userAgent) ? "Firefox" : "Browser";
  return `${os} · ${browser}`;
}

export default async function AuditPage() {
  await requireRole("ADMINISTRATOR");
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  const userIds = [...new Set(rows.filter(row => row.actorType === "USER" && row.actorId).map(row => row.actorId!))];
  const deviceIds = [...new Set(rows.map(row => row.deviceId).filter((id): id is string => Boolean(id)))];
  const [users, devices] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, role: true } }),
    prisma.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } }),
  ]);
  const userMap = new Map(users.map(user => [user.id, user]));
  const deviceMap = new Map(devices.map(device => [device.id, device.name]));
  const groups = Map.groupBy(rows, row => row.createdAt.toLocaleDateString("en-CA", { timeZone: "Europe/London" }));

  return <main className="shell"><Header manager/><div className="content">
    <div className="page-head"><div><h1 className="page-title">Audit log</h1><p className="muted">Events are grouped by day. User names and friendly device details are shown where they were recorded.</p></div></div>
    <nav className="card" style={{ padding: 16, marginBottom: 18 }} aria-label="Audit dates">
      <b>Jump to date</b><div className="tabs" style={{ marginTop: 10 }}>{[...groups.keys()].map(date => <a className="tab" href={`#audit-${date}`} key={date}>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</a>)}</div>
    </nav>
    {[...groups.entries()].map(([date, dayRows]) => <section id={`audit-${date}`} key={date} style={{ scrollMarginTop: 20, marginBottom: 26 }}>
      <h2>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
      <div className="card table-wrap"><table className="table"><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Device and connection</th></tr></thead>
        <tbody>{dayRows.map(row => {
          const user = row.actorId ? userMap.get(row.actorId) : undefined;
          const actor = user ? <><b>{user.name}</b><small className="muted" style={{ display: "block" }}>{user.role.replaceAll("_", " ").toLowerCase()} · {user.email}</small></> : row.actorType === "DEVICE" ? <><b>{row.deviceId ? deviceMap.get(row.deviceId) || "Unknown device" : "Device"}</b><small className="muted" style={{ display: "block" }}>Device action</small></> : <><b>{row.actorType === "USER" ? "Unknown user" : row.actorType}</b>{row.actorId && <small className="muted" style={{ display: "block" }}>{row.actorId}</small>}</>;
          return <tr key={row.id}><td>{row.createdAt.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td><b>{row.action.replaceAll("_", " ")}</b></td><td>{actor}</td><td>{row.entityType || "—"}{row.entityId && <small className="muted" style={{ display: "block" }}>{row.entityId}</small>}</td><td>{row.deviceId && <b>{deviceMap.get(row.deviceId) || "Unknown device"}</b>}<span style={{ display: "block" }}>{clientName(row.userAgent)}</span><small className="muted">{row.ipAddress || "IP not recorded"}</small></td></tr>;
        })}</tbody>
      </table></div>
    </section>)}
  </div></main>;
}
