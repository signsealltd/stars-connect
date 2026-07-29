export type EffectiveClockEvent = {
  id: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  deviceTimestamp: Date;
  deviceId: string;
  corrections?: Array<{ newValue: unknown }>;
};

export function effectiveClockEvent<T extends EffectiveClockEvent>(event: T) {
  const corrected = event.corrections?.at(-1)?.newValue as
    | { type?: "CLOCK_IN" | "CLOCK_OUT"; deviceTimestamp?: string }
    | undefined;
  return {
    ...event,
    type: corrected?.type || event.type,
    deviceTimestamp: corrected?.deviceTimestamp ? new Date(corrected.deviceTimestamp) : event.deviceTimestamp,
  };
}

export function openClockIn<T extends EffectiveClockEvent>(events: T[]) {
  const sorted = events.map(effectiveClockEvent).sort((a, b) => a.deviceTimestamp.getTime() - b.deviceTimestamp.getTime());
  let open: (typeof sorted)[number] | undefined;
  for (const event of sorted) {
    if (event.type === "CLOCK_IN") open = event;
    else open = undefined;
  }
  return open;
}
