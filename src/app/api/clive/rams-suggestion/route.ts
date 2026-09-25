import {hasCapability,CAPABILITIES as C} from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { extractCliveResponse } from "@/lib/clive-core";

import { extractRamsSuggestion, ramsSuggestionRequest } from "@/lib/rams-clive";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/security";
import { sameOriginAllowed } from "@/lib/smtp";

const instructions = `You are Clive, a drafting assistant inside STARS Connect.
Generate practical UK RAMS draft suggestions that match only the supplied activity, location and scope.
Do not claim the assessment is complete, compliant, approved or safe. Do not invent attendee names, medical details, qualifications or site facts.
Use plain English. Prefer specific controls over generic phrases. Scores are preliminary 1-5 likelihood and 1-5 severity estimates and must be reviewed by a competent person.
Return JSON only. For hazards return {"kind":"hazards","hazards":[{"hazard":"...","whoMayBeHarmed":"...","howTheyMayBeHarmed":"...","existingControls":"...","furtherControls":"...","initialLikelihood":1,"initialSeverity":1,"residualLikelihood":1,"residualSeverity":1}]}.
For safeMethod return {"kind":"safeMethod","methodStatement":"...","methodSteps":[{"stage":"...","method":"...","responsibleRole":"...","safetyChecks":"...","stopWorkConditions":"..."}]}.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in again to use Clive." }, { status: 401 });

  if(!hasCapability(session.user.role,C.RAMS_EDIT,session.user.permissionOverrides)||!hasCapability(session.user.role,C.ASSISTANT_USE,session.user.permissionOverrides))return NextResponse.json({error:"RAMS editing and Clive permissions are required."},{status:403});
  if (!sameOriginAllowed(req.headers.get("origin"), req.nextUrl.origin, process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)) return NextResponse.json({ error: "The request origin was not accepted." }, { status: 403 });
  const parsed = ramsSuggestionRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a clear activity title and description before asking Clive." }, { status: 422 });
  const context = requestContext(req);
  const limit = rateLimit(`clive-rams:${session.userId}:${context.ipAddress || "local"}`, 8, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Clive has generated several suggestions. Please wait before trying again.", retryAfter: limit.retryAfter }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Clive suggestions are not configured. Ask an administrator to add the OpenAI API key." }, { status: 503 });
  const input = `SUGGESTION TYPE: ${parsed.data.kind}\nACTIVITY TITLE: ${parsed.data.title}\nACTIVITY DESCRIPTION: ${parsed.data.activityDescription}\nLOCATION: ${parsed.data.location || "Not specified"}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna", store: false, instructions, input, max_output_tokens: 2200 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.warn("[clive-rams] upstream-rejected", response.status);
      return NextResponse.json({ error: "Clive could not generate a suggestion right now." }, { status: 503 });
    }
    const text = extractCliveResponse(await response.json());
    const suggestion = text ? extractRamsSuggestion(text) : null;
    if (!suggestion || suggestion.kind !== parsed.data.kind) return NextResponse.json({ error: "Clive returned an incomplete suggestion. Please try again." }, { status: 502 });
    await audit("CLIVE_RAMS_SUGGESTION_GENERATED", { actorType: "USER", actorId: session.userId, entityType: "RamsSuggestion", afterValue: { kind: suggestion.kind, itemCount: suggestion.kind === "hazards" ? suggestion.hazards.length : suggestion.methodSteps.length }, ...context });
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.warn("[clive-rams] upstream-unavailable", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Clive could not generate a suggestion right now." }, { status: 503 });
  }
}

