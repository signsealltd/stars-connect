"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/header";

type Person = { id: string; name: string; detail?: string };
type LiveData = {
  staff: Person[];
  students: Array<Person & { status: string }>;
  visitors: Array<Person & { company?: string | null; host: string }>;
};

export default function Live() {
  const [data, setData] = useState<LiveData>();
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("Live attendance could not be loaded.");
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Live attendance could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 15_000);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const visitors = data?.visitors.map((visitor) => ({
    ...visitor,
    detail: [visitor.company, visitor.host ? `Host: ${visitor.host}` : undefined].filter(Boolean).join(" · "),
  }));

  return <main className="shell"><Header manager/><div className="content">
    <div className="page-head"><div><h1 className="page-title">Who is on site?</h1><p className="muted">Live server attendance from authorised STARS Connect tablets.</p></div>
      <button className="btn secondary" onClick={load} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin" : undefined}/>Refresh</button>
    </div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {!data ? <div className="card empty">Loading live attendance…</div> : <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>
      <List title={`Staff currently in · ${data.staff.length}`} items={data.staff}/>
      <List title={`Students present · ${data.students.length}`} items={data.students}/>
      <List title={`Visitors on site · ${visitors!.length}`} items={visitors!}/>
    </div>}
  </div></main>;
}

function List({title,items}:{title:string;items:Person[]}) {
  return <section className="card" style={{padding:22}}><h2>{title}</h2>{items.length ? items.map(person => <div key={person.id} style={{fontSize:18,padding:"13px 0",borderTop:"1px solid #e5e9e7"}}>{person.name}{person.detail && <div className="muted">{person.detail}</div>}</div>) : <p className="muted">Nobody recorded.</p>}</section>;
}