export const trainingRoles = ["Director", "Manager", "Assistant Manager", "Team Leader", "Support Worker", "Driver", "Volunteer"] as const;
export type TrainingRequirement = "REQUIRED" | "CONDITIONAL" | "NOT_REQUIRED";
export type RequirementRules = Record<string, TrainingRequirement>;

const all = (value: TrainingRequirement): RequirementRules => Object.fromEntries(trainingRoles.map(role => [role, value]));
const core = (name: string, category: string, overrides: Partial<RequirementRules> = {}) => ({ name, category, requirementRules: { ...all("REQUIRED"), ...overrides }, renewalMonths: 12, warningDays: 60 });
const conditional = (name: string, category: string, overrides: Partial<RequirementRules> = {}) => ({ name, category, requirementRules: { ...all("CONDITIONAL"), ...overrides }, renewalMonths: 12, warningDays: 60 });
const NR: TrainingRequirement = "NOT_REQUIRED", C: TrainingRequirement = "CONDITIONAL", R: TrainingRequirement = "REQUIRED";

export const starsTrainingFramework = [
  core("Induction", "Core compliance"), core("Safeguarding Adults", "Core compliance"), core("Health & Safety", "Core compliance"),
  core("Fire Safety", "Core compliance"), core("GDPR / Data Protection", "Core compliance"), core("Equality, Diversity & Inclusion", "Core compliance"),
  core("Mental Capacity Act", "Care & safeguarding", { Driver:C, Volunteer:C }), core("Person-Centred Working", "Care & safeguarding", { Driver:C, Volunteer:C }),
  core("Infection Prevention & Control", "Care & safeguarding", { Driver:C, Volunteer:C }), core("Learning Disability Awareness", "Care & safeguarding", { Driver:C, Volunteer:C }),
  core("Autism Awareness", "Care & safeguarding", { Driver:C, Volunteer:C }), core("Mental Health Awareness", "Care & safeguarding", { Driver:C, Volunteer:C }),
  core("Oliver McGowan Mandatory Training - Part 1", "Care & safeguarding", { Driver:C, Volunteer:C }), core("Oliver McGowan Mandatory Training - Part 2", "Care & safeguarding", { Driver:C, Volunteer:C }),
  conditional("Positive Behaviour Support (PBS) - Level 1", "Care & safeguarding", { "Team Leader":R, "Support Worker":R }),
  conditional("Conflict Resolution & Personal Safety", "Care & safeguarding", { Manager:R, "Assistant Manager":R, "Team Leader":R, "Support Worker":R }),
  core("Missing Person / Herbert Protocol", "Care & safeguarding", { Driver:C, Volunteer:C }), core("Medication Awareness", "Medication & clinical", { Driver:C, Volunteer:C }),
  conditional("Medication Administration Training", "Medication & clinical"), conditional("Medication Practical Competency", "Medication & clinical"),
  conditional("Epilepsy Awareness", "Medication & clinical"), conditional("Buccal Midazolam Administration & Competency", "Medication & clinical"),
  core("Basic Life Support / CPR & AED", "Medication & clinical", { Driver:C, Volunteer:C }), conditional("Diabetes Awareness", "Medication & clinical"),
  conditional("First Aid at Work", "Health, safety & premises"), conditional("Moving & Handling", "Health, safety & premises"),
  core("COSHH", "Health, safety & premises", { Driver:C, Volunteer:C }), conditional("Food Safety & Hygiene", "Health, safety & premises"),
  core("Legionella Awareness", "Health, safety & premises", { "Team Leader":C, "Support Worker":NR, Driver:NR, Volunteer:NR }),
  core("Emergency Procedures", "Health, safety & premises"), conditional("Outings / Community Activities", "Role / workplace specific", { Director:R, Manager:R, "Assistant Manager":R, "Team Leader":R, "Support Worker":R }),
  conditional("Driving for Work", "Role / workplace specific", { Driver:R }), core("STARS Connect", "Role / workplace specific"),
  core("Safeguarding Lead Training", "Role / workplace specific", { "Assistant Manager":C, "Team Leader":C, "Support Worker":NR, Driver:NR, Volunteer:NR }),
  core("Management / Supervision", "Role / workplace specific", { "Support Worker":NR, Driver:NR, Volunteer:NR }),
  core("Building Effective Working Relationships", "Role / workplace specific"), core("Stress Awareness & Wellbeing", "Role / workplace specific"),
] as const;

export function normaliseTrainingRole(jobRole: string) {
  const value = jobRole.trim().toLowerCase();
  return [...trainingRoles].sort((a, b) => b.length - a.length).find(role => value.includes(role.toLowerCase())) || "Support Worker";
}

export function trainingState(input: { requirement: TrainingRequirement; expiryDate?: Date | string | null; completedDate?: Date | string | null }, now = new Date(), warningDays = 60) {
  if (input.requirement === "NOT_REQUIRED") return "NOT_REQUIRED" as const;
  if (!input.completedDate) return input.requirement === "REQUIRED" ? "MISSING" as const : "CONDITIONAL" as const;
  if (!input.expiryDate) return "CURRENT" as const;
  const days = Math.ceil((new Date(input.expiryDate).getTime() - now.getTime()) / 86400000);
  if (days < 0) return "EXPIRED" as const;
  if (days <= warningDays) return "DUE_SOON" as const;
  return "CURRENT" as const;
}
