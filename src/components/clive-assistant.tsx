"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ExternalLink, Send, ShieldCheck, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { id: string; from: "user" | "clive"; text: string; route?: string };
const managerPaths = ["/dashboard", "/timesheets", "/live", "/reports", "/settings"];
const suggestions = ["How do I correct a forgotten clock-out?", "How do I run payroll safely?", "What should I check every morning?"];

export function CliveAssistant() {
  const pathname = usePathname();
  const [authorised, setAuthorised] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", from: "clive", text: "Hello, I am Clive. Ask me how to use STARS Connect and I will guide you through it step by step." }]);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const visible = managerPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (!visible) { setAuthorised(false); setOpen(false); return; }
    const controller = new AbortController();
    fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).then((response) => setAuthorised(response.ok)).catch(() => setAuthorised(false));
    return () => controller.abort();
  }, [visible]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function ask(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (!text || busy) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const response = await fetch("/api/clive", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, pathname }) });
      const result = await response.json().catch(() => null);
      if (response.status === 401) { location.assign("/login"); return; }
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: "clive", text: response.ok ? result.answer : result?.error || "I am temporarily unavailable. STARS Connect itself is still working normally.", route: response.ok ? result.suggestedRoute : undefined }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: "clive", text: "I am temporarily unavailable. STARS Connect itself is still working normally." }]);
    } finally { setBusy(false); }
  }

  if (!visible || !authorised) return null;
  return <>
    {open && <section className="clive-panel no-print" aria-label="Clive help assistant">
      <header className="clive-head"><span className="clive-avatar"><Bot aria-hidden="true" /></span><div><strong>Clive</strong><small>STARS Connect help</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Clive"><X /></button></header>
      <div className="clive-privacy"><ShieldCheck size={16} /> Do not enter names, contact details, PINs, passwords or medical information.</div>
      <div className="clive-messages" aria-live="polite">{messages.map((message) => <div className={`clive-message ${message.from}`} key={message.id}><span>{message.text}</span>{message.from === "clive" && message.route && <Link href={message.route} onClick={() => setOpen(false)}>Open the relevant page <ExternalLink size={14} /></Link>}</div>)}{busy && <div className="clive-message clive"><span>Clive is checking the approved guidance...</span></div>}<div ref={end} /></div>
      {messages.length === 1 && <div className="clive-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void ask(undefined, suggestion)}>{suggestion}</button>)}</div>}
      <form className="clive-form" onSubmit={(event) => void ask(event)}><label htmlFor="clive-question">Ask Clive</label><div><input ref={input} id="clive-question" value={question} maxLength={600} autoComplete="off" placeholder="How do I...?" onChange={(event) => setQuestion(event.target.value)} /><button type="submit" disabled={busy || question.trim().length < 2} aria-label="Send question"><Send /></button></div></form>
      <p className="clive-disclaimer">Guidance only. Clive cannot change records or make safeguarding, employment, payroll or compliance decisions.</p>
    </section>}
    <button type="button" className="clive-launcher no-print" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close Clive" : "Ask Clive for help"}>{open ? <X /> : <Bot />}<span>{open ? "Close" : "Ask Clive"}</span></button>
  </>;
}