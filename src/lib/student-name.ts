export type StudentNameParts = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
};

export function studentFullName(student: StudentNameParts) {
  const fullName = [student.firstName, student.lastName]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || student.displayName?.trim() || "Service user";
}
