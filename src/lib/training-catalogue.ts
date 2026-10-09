import catalogue from "./training-catalogue-data.json";

export const proposedTrainingCatalogue = catalogue;
export const trainingEvidenceKinds = ["COURSE", "THEORY", "LOCAL", "PRACTICAL", "EXTERNAL", "FULL_TIER2"] as const;

export const protectedTrainingEntries = [
  { name: "STARS Local Induction", evidenceKind: "LOCAL" },
  { name: "Medication Practical Competency", evidenceKind: "PRACTICAL" },
  { name: "Buccal Midazolam Practical Competency", evidenceKind: "PRACTICAL" },
  { name: "Moving and Handling Practical Competency", evidenceKind: "PRACTICAL" },
  { name: "First Aid at Work", evidenceKind: "EXTERNAL" },
  { name: "Emergency First Aid at Work", evidenceKind: "EXTERNAL" },
  { name: "Oliver McGowan Tier 2 Face-to-Face Session", evidenceKind: "PRACTICAL" },
  { name: "Care Certificate Workplace Assessment", evidenceKind: "PRACTICAL" },
  { name: "Missing Person and Herbert Protocol", evidenceKind: "LOCAL" },
  { name: "Driving for Business", evidenceKind: "LOCAL" },
  { name: "Fire Evacuation and Site Familiarisation", evidenceKind: "LOCAL" },
] as const;

export function explicitNumberedLevel(title: string) {
  const match = title.match(/\blevel\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

export function needsFullTier2Verification(course: { name: string; evidenceKind?: string }) {
  return course.evidenceKind === "FULL_TIER2" || (/oliver\s+mcgowan/i.test(course.name) && /full.*(?:tier\s*2|package)|tier\s*2.*(?:full|package)/i.test(course.name));
}

export function tier2EvidenceError(course: { name: string; evidenceKind?: string }, record: { fullTier2Verified?: boolean; certificateReference?: string | null }) {
  if (needsFullTier2Verification(course) && (!record.fullTier2Verified || !record.certificateReference?.trim())) {
    return "Verify both online and face-to-face completion evidence and provide its reference before recording the full Tier 2 package.";
  }
  if (!needsFullTier2Verification(course) && record.fullTier2Verified) {
    return "Record full Tier 2 verification against the separate full-package requirement, not a theory or face-to-face course.";
  }
  return null;
}

export function trainingRecordMatchesCourse(
  record: {courseId?:string|null;courseName:string;fullTier2Verified?:boolean;certificateReference?:string|null},
  course: {id:string;name:string;catalogueKey?:string|null;evidenceKind?:string},
) {
  const fullPackage = needsFullTier2Verification(course);
  const linked = record.courseId === course.id;
  // Legacy unlinked records can still match legacy subjects. Imported provider courses
  // and full packages require an explicit course ID; titles never transfer credit.
  const legacyName = !record.courseId && !course.catalogueKey && !fullPackage && record.courseName.toLowerCase() === course.name.toLowerCase();
  return (linked || legacyName) && (!fullPackage || (!!record.fullTier2Verified && !!record.certificateReference?.trim()));
}
