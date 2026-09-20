"use client";

import {CliveBillingGuide} from "./clive-billing-guide";
import {billingHelpForQuestion,type BillingHelpTopic} from "@/lib/billing-help";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Send, ShieldCheck, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; from: "user" | "clive"; text: string; route?: string; billingTopic?: BillingHelpTopic };
const managerPaths = ["/dashboard", "/timesheets", "/live", "/reports", "/settings"];
const suggestions = ["How do I correct a forgotten clock-out?", "How do I run payroll safely?", "What should I check every morning?"];

function CliveImage({className,meaningful=false}:{className:string;meaningful?:boolean}) {
  const [failed,setFailed]=useState(false);
  if(failed)return null;
  return <picture className={className}><source srcSet="/images/clive/ask-clive.webp" type="image/webp" />{/* The original PNG is retained as the source and browser fallback. */}<img src="/images/clive/ask-clive.png" width={1254} height={1254} alt={meaningful?"Clive, the STARS Connect assistant":""} onError={(event)=>{const image=event.currentTarget;const source=image.parentElement?.querySelector("source");if(source){source.remove();image.src="/images/clive/ask-clive.png"}else setFailed(true)}} /></picture>;
}

export function CliveAssistant() {
  const pathname = usePathname();
  const [guide,setGuide]=useState<BillingHelpTopic>();
  const closeGuide=useCallback(()=>{setGuide(undefined);requestAnimationFrame(()=>launcher.current?.focus())},[]);
  const billing=pathname==="/dashboard/billing";
  useEffect(()=>setGuide(undefined),[pathname]);
  const [authorised, setAuthorised] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", from: "clive", text: "Hello, I am Clive. Ask me how to use STARS Connect and I will guide you through it step by step." }]);
  const launcher = useRef<HTMLButtonElement>(null);
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
  useEffect(() => { if(messages.length>1)end.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"nearest" }); }, [messages, busy]);
  function close(){setOpen(false);requestAnimationFrame(()=>launcher.current?.focus())}
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);requestAnimationFrame(()=>launcher.current?.focus())}};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape)},[open]);
  useEffect(() => {
    const openWithQuestion = (event: Event) => {
      setQuestion((event as CustomEvent<{ question?: string }>).detail?.question?.slice(0, 600) || "");
      setOpen(true);
    };
    window.addEventListener("stars-open-clive", openWithQuestion);
    return () => window.removeEventListener("stars-open-clive", openWithQuestion);
  }, []);

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
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: "clive", text: response.ok ? result.answer : result?.error || "I am temporarily unavailable. STARS Connect itself is still working normally.", route: response.ok ? result.suggestedRoute : undefined, billingTopic:response.ok&&billing?billingHelpForQuestion(text):undefined }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: "clive", text: "I am temporarily unavailable. STARS Connect itself is still working normally." }]);
    } finally { setBusy(false); }
  }

  if (!visible || !authorised) return null;
  return <>
    {guide&&billing&&<CliveBillingGuide topic={guide} onClose={closeGuide}/>}
    {open && <section id="clive-panel" className="clive-panel no-print" role="dialog" aria-label="Clive help assistant">
      <header className="clive-head"><span className="clive-avatar"><CliveImage className="clive-header-image" /></span><div><strong>Clive</strong><small>STARS Connect help</small></div><button type="button" onClick={close} aria-label="Close Clive"><X /></button></header>
      <div className="clive-privacy"><ShieldCheck size={16} /> Do not enter names, contact details, PINs, passwords or medical information.</div>
      <div className="clive-messages" aria-live="polite">{messages.length===1&&<div className="clive-welcome"><CliveImage className="clive-welcome-image" meaningful /><h2>How can I help?</h2></div>}{messages.map((message) => <div className={`clive-message ${message.from}`} key={message.id}><span>{message.text}</span>{billing&&message.billingTopic&&<button className="btn secondary" onClick={()=>{setGuide(message.billingTopic);setOpen(false)}}>Show me</button>}{message.from === "clive" && message.route && <Link href={message.route} onClick={() => setOpen(false)}>Open the relevant page <ExternalLink size={14} /></Link>}</div>)}{busy && <div className="clive-message clive"><span>Clive is checking the approved guidance...</span></div>}<div ref={end} /></div>
      {messages.length === 1 && <div className="clive-suggestions">{(billing?["How do I choose manual billing dates?","How do I exclude bank holidays?","How do I change a client total?","Where are previous invoices?"]:suggestions).map((suggestion) => <button type="button" key={suggestion} onClick={() => void ask(undefined, suggestion)}>{suggestion}</button>)}</div>}
      <form className="clive-form" onSubmit={(event) => void ask(event)}><label htmlFor="clive-question">Ask Clive</label><div><input ref={input} id="clive-question" value={question} maxLength={600} autoComplete="off" placeholder="How do I...?" onChange={(event) => setQuestion(event.target.value)} /><button type="submit" disabled={busy || question.trim().length < 2} aria-label="Send question"><Send /></button></div></form>
      <p className="clive-disclaimer">Guidance only. Clive cannot change records or make safeguarding, employment, payroll or compliance decisions.</p>
    </section>}
    <button ref={launcher} hidden={open||!!guide} type="button" className="clive-launcher no-print" aria-controls="clive-panel" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close Clive" : "Ask Clive for help"}><CliveImage className="clive-launcher-image" /><span>{open ? "Close" : "Ask Clive"}</span></button>
  </>;
}
