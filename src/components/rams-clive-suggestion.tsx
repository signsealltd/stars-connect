"use client";

import { Bot, Check, X } from "lucide-react";
import { useState } from "react";
import type { RamsSuggestion } from "@/lib/rams-clive";

type Props = {
  kind: "hazards" | "safeMethod";
  title: string;
  activityDescription: string;
  location: string;
  onAccept: (suggestion: RamsSuggestion) => void;
};

export function RamsCliveSuggestion({ kind, title, activityDescription, location, onAccept }: Props) {
  const [suggestion, setSuggestion] = useState<RamsSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = async () => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/clive/rams-suggestion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, title, activityDescription, location }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setSuggestion(payload.suggestion);
    else setError(payload.error || "Clive could not create a suggestion.");
    setBusy(false);
  };

  return <>
    <button type="button" className="btn clive-suggestion-button" disabled={busy || title.trim().length < 2 || activityDescription.trim().length < 8} onClick={() => void request()}>
      <Bot />{busy ? "Clive is drafting..." : "Clive Suggestion"}
    </button>
    {error && <div className="alert">{error}</div>}
    {suggestion && <div className="rams-suggestion-overlay" role="dialog" aria-modal="true" aria-label="Clive RAMS suggestion">
      <div className="rams-suggestion-modal">
        <header>
          <div><span className="badge badge-info">Draft suggestion</span><h3>Clive&apos;s {kind === "hazards" ? "hazards and controls" : "safe method"} suggestion</h3><p>Review every item. Nothing will be added until you accept it.</p></div>
          <button type="button" className="btn secondary compact" onClick={() => setSuggestion(null)}><X />Close</button>
        </header>
        <div className="rams-suggestion-content">
          {suggestion.kind === "hazards" ? suggestion.hazards.map((item, index) => <article key={`${item.hazard}-${index}`}>
            <strong>{index + 1}. {item.hazard}</strong>
            <p><b>Who may be harmed:</b> {item.whoMayBeHarmed}</p><p><b>How:</b> {item.howTheyMayBeHarmed}</p><p><b>Suggested controls:</b> {item.existingControls}</p>
            {item.furtherControls && <p><b>Further controls:</b> {item.furtherControls}</p>}
            <small>Initial score {item.initialLikelihood * item.initialSeverity}; suggested residual score {item.residualLikelihood * item.residualSeverity}</small>
          </article>) : <><p>{suggestion.methodStatement}</p>{suggestion.methodSteps.map((step, index) => <article key={`${step.stage}-${index}`}>
            <strong>{index + 1}. {step.stage}</strong><p>{step.method}</p>{step.safetyChecks && <p><b>Checks:</b> {step.safetyChecks}</p>}{step.stopWorkConditions && <p><b>Stop if:</b> {step.stopWorkConditions}</p>}
          </article>)}</>}
        </div>
        <footer><button type="button" className="btn secondary" onClick={() => setSuggestion(null)}>Close without using</button><button type="button" className="btn primary" onClick={() => { onAccept(suggestion); setSuggestion(null); }}><Check />Accept and add to draft</button></footer>
        <p className="rams-note">Draft suggestions must be checked for relevance, suitable controls and accurate risk scores by a competent person before review or approval.</p>
      </div>
    </div>}
  </>;
}
