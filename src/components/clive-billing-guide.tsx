"use client";
import { useEffect, useRef, useState } from "react";
import { billingHelpTopics, type BillingHelpTopic } from "@/lib/billing-help";

export function CliveBillingGuide({ topic, onClose }: { topic: BillingHelpTopic; onClose: () => void }) {
  const [current, setCurrent] = useState(topic);
  const [found, setFound] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  useEffect(() => {
    document.body.classList.add("clive-guiding");
    const area = document.getElementById(current.target);
    const node = area?.matches("button,input,select") ? area : area?.querySelector<HTMLElement>("select,input,button") || area;
    const visible = !!node && node.getClientRects().length > 0;
    setFound(visible);
    if (visible) {
      node.classList.add("clive-guided-target");
      node.scrollIntoView({ block: "start", behavior: "instant" });
    }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => { node?.classList.remove("clive-guided-target"); document.body.classList.remove("clive-guiding"); window.removeEventListener("keydown", escape); };
  }, [current, onClose]);
  return <aside className="clive-billing-guide no-print" aria-label="Clive billing guidance">
    <header><strong>{current.title}</strong><button ref={close} className="btn secondary" onClick={onClose}>Close guide</button></header>
    <p role="status">{found ? "The relevant area is outlined on the page." : "This control is on another billing step. Follow the instructions below, then choose the topic again."}</p>
    <p>{current.content}</p>
    <label>Show another billing topic<select className="field" value={current.id} onChange={e => setCurrent(billingHelpTopics.find(t => t.id === e.target.value)!)}>{billingHelpTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
  </aside>;
}
