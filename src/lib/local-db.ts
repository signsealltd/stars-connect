import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LocalAttendance, LocalClockEvent, LocalStudent, PendingChange } from "./types";

type LocalStaff = { id: string; displayName: string; currentState: "IN" | "OUT" };
type RollCall = { id: string; startedAt: string; entries: Array<{ id:string;personType:string;personId:string;displayName:string;accountedFor:boolean }> };
type Conflict = { id:string;eventId:string;operation:string;reason:string;payload:unknown;createdAt:string };
type PulledEvent = { sequence:string;eventId:string;operation:"CLOCK_EVENT"|"ATTENDANCE"|"ROLL_CALL_ENTRY";payload:Record<string,unknown>;createdAt:string };

interface StarsConnectDB extends DBSchema {
  staff:{key:string;value:LocalStaff};
  students:{key:string;value:LocalStudent};
  attendance:{key:string;value:LocalAttendance;indexes:{"by-date":string}};
  clockEvents:{key:string;value:LocalClockEvent;indexes:{"by-time":string}};
  pending:{key:string;value:PendingChange};
  metadata:{key:string;value:{key:string;value:unknown}};
  rollCalls:{key:string;value:RollCall};
  appliedEvents:{key:string;value:{eventId:string;sequence:string;appliedAt:string}};
  conflicts:{key:string;value:Conflict};
}

// Keep the original database name for deployed alpha-tablet compatibility.
export const db = () => openDB<StarsConnectDB>("pulse-tablet", 2, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      database.createObjectStore("staff", { keyPath: "id" });
      database.createObjectStore("students", { keyPath: "id" });
      const attendance = database.createObjectStore("attendance", { keyPath: "id" });
      attendance.createIndex("by-date", "date");
      const clocks = database.createObjectStore("clockEvents", { keyPath: "id" });
      clocks.createIndex("by-time", "deviceTimestamp");
      database.createObjectStore("pending", { keyPath: "id" });
      database.createObjectStore("metadata", { keyPath: "key" });
      database.createObjectStore("rollCalls", { keyPath: "id" });
    }
    if (oldVersion < 2) {
      database.createObjectStore("appliedEvents", { keyPath: "eventId" });
      database.createObjectStore("conflicts", { keyPath: "id" });
    }
  },
});

function emitSyncStatus(detail: Record<string, unknown>) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stars-connect-sync", { detail }));
}

export async function queueChange(change: PendingChange) {
  const database = await db();
  await database.put("pending", change);
  await database.put("metadata", { key: "lastLocalChange", value: new Date().toISOString() });
  emitSyncStatus(await getSyncSnapshot(database));
}

export async function pendingCount() {
  return (await db()).count("pending");
}

export async function saveAttendance(value: LocalAttendance) {
  const database = await db();
  await database.put("attendance", value);
  await queueChange({ id: value.id, operation: "ATTENDANCE", payload: value, createdAt: new Date().toISOString(), attempts: 0 });
}

async function recordLocalConflict(database: IDBPDatabase<StarsConnectDB>, event: PulledEvent, reason: string) {
  await database.put("conflicts", {
    id: crypto.randomUUID(), eventId: event.eventId, operation: event.operation,
    reason, payload: event.payload, createdAt: new Date().toISOString(),
  });
}

export async function applyPulledEvent(database: IDBPDatabase<StarsConnectDB>, event: PulledEvent) {
  if (await database.get("appliedEvents", event.eventId)) return "duplicate";
  const payload = event.payload;
  if (!payload || typeof payload !== "object") throw new Error("Malformed event payload");

  if (event.operation === "CLOCK_EVENT") {
    const staffId = String(payload.staffId || "");
    const type = String(payload.type || "");
    const timestamp = String(payload.deviceTimestamp || "");
    if (!staffId || !["CLOCK_IN","CLOCK_OUT"].includes(type) || !Date.parse(timestamp)) throw new Error("Malformed clock event");
    const existing = await database.get("clockEvents", event.eventId);
    if (!existing) {
      const clock: LocalClockEvent = {
        id: event.eventId, staffId, staffName: String(payload.staffName || "Staff member"),
        type: type as LocalClockEvent["type"], deviceId: String(payload.deviceId || ""),
        deviceTimestamp: timestamp, offlineRecorded: Boolean(payload.offlineRecorded),
        photoStatus: (payload.photoStatus as LocalClockEvent["photoStatus"]) || "NOT_REQUIRED",
      };
      await database.put("clockEvents", clock);
      const current = await database.get("staff", staffId);
      await database.put("staff", { id: staffId, displayName: clock.staffName || current?.displayName || "Staff member", currentState: type === "CLOCK_IN" ? "IN" : "OUT" });
    }
  } else if (event.operation === "ATTENDANCE") {
    const studentId = String(payload.studentId || "");
    const date = String(payload.date || "");
    const version = Number(payload.version || 0);
    if (!studentId || !date || !version) throw new Error("Malformed attendance event");
    const matching = (await database.getAllFromIndex("attendance", "by-date", date)).find((a) => a.studentId === studentId);
    if (matching && matching.version > version) {
      await recordLocalConflict(database, event, "Pulled attendance is older than this tablet's local version");
    } else if (!matching || matching.version <= version) {
      const attendance: LocalAttendance = {
        id: matching?.id || event.eventId, studentId, date,
        status: payload.status as LocalAttendance["status"],
        arrivalTime: payload.arrivalTime ? String(payload.arrivalTime) : undefined,
        departureTime: payload.departureTime ? String(payload.departureTime) : undefined,
        note: payload.note ? String(payload.note) : undefined,
        deviceTimestamp: String(payload.deviceTimestamp), version,
      };
      await database.put("attendance", attendance);
    }
  } else if (event.operation === "ROLL_CALL_ENTRY") {
    const rollCallId = String(payload.rollCallId || "");
    const entryId = String(payload.id || "");
    if (!rollCallId || !entryId) throw new Error("Malformed roll-call event");
    const rollCall = await database.get("rollCalls", rollCallId);
    if (rollCall) {
      const entry = { id:entryId,personType:String(payload.personType),personId:String(payload.personId),displayName:String(payload.displayName),accountedFor:Boolean(payload.accountedFor) };
      const entries = rollCall.entries.some((e) => e.id === entryId) ? rollCall.entries.map((e) => e.id === entryId ? entry : e) : [...rollCall.entries, entry];
      await database.put("rollCalls", { ...rollCall, entries });
    }
  }
  await database.put("appliedEvents", { eventId: event.eventId, sequence: event.sequence, appliedAt: new Date().toISOString() });
  return "applied";
}

export async function applyPulledBatch(events: PulledEvent[]) {
  const database = await db();
  let cursor = String((await database.get("metadata", "syncCursor"))?.value || localStorage.getItem("pulse-sync-cursor") || "0");
  for (const event of events) {
    try {
      await applyPulledEvent(database, event);
      cursor = event.sequence;
      await database.put("metadata", { key: "syncCursor", value: cursor });
      localStorage.setItem("pulse-sync-cursor", cursor);
    } catch (error) {
      await recordLocalConflict(database, event, error instanceof Error ? error.message : "Unable to apply pulled event");
      throw error;
    }
  }
  return cursor;
}

export async function getSyncSnapshot(database?: IDBPDatabase<StarsConnectDB>) {
  const d = database || await db();
  return {
    queued: await d.count("pending"),
    conflicts: await d.count("conflicts"),
    lastSync: (await d.get("metadata", "lastSync"))?.value,
    syncError: (await d.get("metadata", "syncError"))?.value,
  };
}

let activeSync: Promise<boolean> | null = null;
export function syncNow() {
  if (activeSync) return activeSync;
  activeSync = performSync().finally(() => { activeSync = null; });
  return activeSync;
}

async function performSync() {
  if (!navigator.onLine) return false;
  const database = await db();
  emitSyncStatus({ ...(await getSyncSnapshot(database)), syncing: true });
  try {
    const changes = await database.getAll("pending");
    const cursor = String((await database.get("metadata", "syncCursor"))?.value || localStorage.getItem("pulse-sync-cursor") || "0");
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": localStorage.getItem("pulse-device-id") || "development-device",
        authorization: `Bearer ${localStorage.getItem("pulse-device-token") || "development-token"}`,
      },
      body: JSON.stringify({ cursor, events: changes }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Synchronisation was rejected");
    const result = await response.json();
    await applyPulledBatch(result.events || []);
    for (const id of result.acknowledged || []) await database.delete("pending", id);
    const appliedCursor = String(result.events?.at(-1)?.sequence || cursor);
    await database.put("metadata", { key: "syncCursor", value: appliedCursor });
    await database.put("metadata", { key: "lastSync", value: new Date().toISOString() });
    await database.delete("metadata", "syncError");
    localStorage.setItem("pulse-sync-cursor", appliedCursor);
    emitSyncStatus({ ...(await getSyncSnapshot(database)), syncing: false });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation failed";
    await database.put("metadata", { key: "syncError", value: message });
    emitSyncStatus({ ...(await getSyncSnapshot(database)), syncing: false });
    return false;
  }
}
