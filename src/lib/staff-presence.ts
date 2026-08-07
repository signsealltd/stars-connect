export type StaffClockState = {
  type: "CLOCK_IN" | "CLOCK_OUT";
  deviceTimestamp: Date;
};

export type StaffPresenceState = {
  type: "WENT_OFFSITE" | "RETURNED_ONSITE";
  deviceTimestamp: Date;
};

export type StaffOccupancy = "OUT" | "ONSITE" | "OFFSITE";

export function staffOccupancy(
  clock?: StaffClockState,
  presence?: StaffPresenceState,
): StaffOccupancy {
  if (!clock || clock.type === "CLOCK_OUT") return "OUT";
  if (!presence || presence.deviceTimestamp <= clock.deviceTimestamp) return "ONSITE";
  return presence.type === "WENT_OFFSITE" ? "OFFSITE" : "ONSITE";
}
