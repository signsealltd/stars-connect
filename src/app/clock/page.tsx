"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Bus, CheckCircle2, Delete, DoorOpen, LogOut } from "lucide-react";
import { Header } from "@/components/header";
import { db, queueChange, syncNow } from "@/lib/local-db";
import type { LocalClockEvent, LocalStaffPresenceEvent } from "@/lib/types";

type VerifiedStaff = {
  staffId: string;
  displayName: string;
  nextAction: LocalClockEvent["type"];
  clockedIn: boolean;
  offsite: boolean;
  cameraRequired: boolean;
};

type StaffAction = LocalClockEvent["type"] | LocalStaffPresenceEvent["type"];
type Result = { name: string; action: StaffAction; time: string };

async function captureFrontPhoto() {
  const stream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:{exact:"user"},width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 350));
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

const resultText: Record<StaffAction, string> = {
  CLOCK_IN: "Clocked in",
  CLOCK_OUT: "Clocked out",
  WENT_OFFSITE: "Marked offsite — shift remains open",
  RETURNED_ONSITE: "Returned onsite — shift remains open",
};

export default function ClockPage() {
  const [pin, setPin] = useState("");
  const [transportDuty, setTransportDuty] = useState(false);
  const [verified, setVerified] = useState<VerifiedStaff>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result>();
  const press = (number: string) => pin.length < 8 && setPin((value) => value + number);

  async function verifyPin() {
    if (pin.length < 4) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/clock/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": localStorage.getItem("pulse-device-id") || "development-device",
          authorization: `Bearer ${localStorage.getItem("pulse-device-token") || "development-token"}`,
        },
        body: JSON.stringify({ pin }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "PIN not recognised. Please try again.");
      setVerified(body as VerifiedStaff);
      setPin("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PIN not recognised. Please try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function recordAction(action: StaffAction) {
    if (!verified) return;
    setBusy(true);
    setError("");
    try {
      const database = await db();
      const deviceId = localStorage.getItem("pulse-device-id") || "development-device";
      const timestamp = new Date().toISOString();
      const id = crypto.randomUUID();

      if (action === "CLOCK_IN" || action === "CLOCK_OUT") {
        let photoDataUrl: string | undefined;
        let photoStatus: LocalClockEvent["photoStatus"] = "NOT_REQUIRED";
        if (verified.cameraRequired) {
          try {
            photoDataUrl = await captureFrontPhoto();
            photoStatus = "CAPTURED";
          } catch {
            throw new Error("A front-camera photograph is required. Allow camera access and try again.");
          }
        }
        const event: LocalClockEvent = {
          id,
          staffId: verified.staffId,
          staffName: verified.displayName,
          type: action,
          deviceId,
          deviceTimestamp: timestamp,
          offlineRecorded: !navigator.onLine,
          photoStatus,
          transportDuty,
        };
        await database.put("clockEvents", event);
        await database.put("staff", { id: event.staffId, displayName: event.staffName, currentState: action === "CLOCK_IN" ? "IN" : "OUT" });
        await queueChange({ id, operation: "CLOCK_EVENT", payload: { ...event, ...(photoDataUrl ? { photoDataUrl } : {}) }, createdAt: timestamp, attempts: 0 });
      } else {
        const event: LocalStaffPresenceEvent = {
          id,
          staffId: verified.staffId,
          staffName: verified.displayName,
          type: action,
          deviceId,
          deviceTimestamp: timestamp,
          offlineRecorded: !navigator.onLine,
        };
        await database.put("staff", { id: event.staffId, displayName: event.staffName, currentState: action === "WENT_OFFSITE" ? "OFFSITE" : "IN" });
        await queueChange({ id, operation: "STAFF_PRESENCE", payload: event, createdAt: timestamp, attempts: 0 });
      }

      void syncNow();
      setResult({ name: verified.displayName, action, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
      setTimeout(() => { location.href = "/"; }, 3500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The attendance action could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (result) return <main className="shell"><Header/><div className="content" style={{ textAlign: "center", paddingTop: 90 }}><CheckCircle2 size={88} color="#177e59"/><h1 className="page-title" style={{ marginTop: 24 }}>{result.name}</h1><p style={{ fontSize: 28 }}>{resultText[result.action]} · {result.time}</p><p className="muted">Saved {navigator.onLine ? "and syncing" : "on this tablet — awaiting sync"}</p></div></main>;

  if (verified) {
    return <main className="shell"><Header/><div className="content" style={{ maxWidth: 760, textAlign: "center", paddingTop: 50 }}><button type="button" className="btn secondary" onClick={() => setVerified(undefined)} disabled={busy}><ArrowLeft size={19}/>Use a different PIN</button><h1 className="page-title" style={{ marginTop: 28 }}>{verified.displayName}</h1><p className="muted" style={{ fontSize: 18 }}>{verified.clockedIn ? verified.offsite ? "You are clocked in and currently marked offsite." : "You are clocked in and currently onsite." : "You are currently clocked out."}</p><div className="card" style={{ padding: 28, marginTop: 24 }}><div style={{ display: "grid", gap: 16, maxWidth: 520, margin: "0 auto" }}>{!verified.clockedIn && <button className="btn primary" style={{ minHeight: 72, fontSize: 20 }} onClick={() => void recordAction("CLOCK_IN")} disabled={busy}>Clock in</button>}{verified.clockedIn && !verified.offsite && <button className="btn primary" style={{ minHeight: 72, fontSize: 20 }} onClick={() => void recordAction("WENT_OFFSITE")} disabled={busy}><DoorOpen size={27}/>Go offsite</button>}{verified.clockedIn && verified.offsite && <button className="btn primary" style={{ minHeight: 72, fontSize: 20 }} onClick={() => void recordAction("RETURNED_ONSITE")} disabled={busy}><DoorOpen size={27}/>Return onsite</button>}{verified.clockedIn && <button className="btn secondary" style={{ minHeight: 64, fontSize: 18 }} onClick={() => void recordAction("CLOCK_OUT")} disabled={busy}><LogOut size={24}/>Clock out — finish work</button>}</div><p className="muted" style={{ marginTop: 22 }}>Going offsite keeps your paid shift open. Only clock out when you have finished work.</p>{error && <p role="alert" style={{ color: "#a72f2f", fontWeight: 700 }}>{error}</p>}</div></div></main>;
  }

  return <main className="shell clock-pin-page"><Header/><div className="content clock-pin-content"><Link href="/" className="muted" style={{ display: "inline-flex", gap: 7, textDecoration: "none" }}><ArrowLeft size={20}/>Back to home</Link><div className="clock-pin-panel"><h1 className="page-title">Enter your PIN</h1><p className="muted">Clock in, clock out, go offsite or return onsite.</p><button type="button" className={`btn transport-toggle ${transportDuty ? "primary selected" : "secondary"}`} onClick={() => setTransportDuty(!transportDuty)} aria-pressed={transportDuty}><Bus size={32}/><strong>{transportDuty ? "Student transport selected" : "Student transport"}</strong></button><div className="pin-dots">{Array.from({ length: Math.max(4, pin.length) }, (_, index) => <i key={index} className={index < pin.length ? "on" : ""}/>)}</div>{error && <p role="alert" style={{ color: "#a72f2f", fontWeight: 700 }}>{error}</p>}<div className="grid keypad">{[1,2,3,4,5,6,7,8,9].map((number) => <button className="key" key={number} onClick={() => press(String(number))}>{number}</button>)}<button className="key" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="Delete"><Delete/></button><button className="key" onClick={() => press("0")}>0</button><button className="key primary pin-submit" onClick={() => void verifyPin()} disabled={busy || pin.length < 4}>{busy ? "…" : "OK"}</button></div></div></div></main>;
}
