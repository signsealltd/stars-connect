import { isExpectedDay } from "./dates";

type Student = { id: string; expectedDays: unknown };
type Attendance = {
  studentId: string;
  status: "NOT_MARKED" | "PRESENT" | "ABSENT" | "OFFSITE" | "LATE" | "CANCELLED";
};
type LatestClockEvent = {
  type: "CLOCK_IN" | "CLOCK_OUT";
  deviceTimestamp: Date;
};

export function studentDashboardMetrics(
  students: Student[],
  attendance: Attendance[],
  date: string,
) {
  const activeIds = new Set(students.map((student) => student.id));
  const activeAttendance = attendance.filter((row) => activeIds.has(row.studentId));
  const expectedIds = new Set(
    students
      .filter((student) => isExpectedDay(student.expectedDays, date))
      .map((student) => student.id),
  );
  const markedExpectedIds = new Set(
    activeAttendance
      .filter((row) => expectedIds.has(row.studentId) && row.status !== "NOT_MARKED")
      .map((row) => row.studentId),
  );

  return {
    present: activeAttendance.filter(
      (row) => row.status === "PRESENT" || row.status === "LATE",
    ).length,
    absent: activeAttendance.filter((row) => row.status === "ABSENT").length,
    offsite: activeAttendance.filter((row) => row.status === "OFFSITE").length,
    late: activeAttendance.filter((row) => row.status === "LATE").length,
    expected: expectedIds.size,
    notMarked: [...expectedIds].filter((id) => !markedExpectedIds.has(id)).length,
  };
}

export function staffDashboardMetrics(
  latestEvents: LatestClockEvent[],
  dayStart: Date,
) {
  const open = latestEvents.filter((event) => event.type === "CLOCK_IN");
  return {
    staffIn: open.length,
    missingClockOut: open.filter((event) => event.deviceTimestamp < dayStart).length,
  };
}
