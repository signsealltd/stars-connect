import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { hrOwnPersonal, hrOwnMedical } from "./staff-hr";
import { RequestError } from "./request-error";

const proposalSchema = z.object({personal:hrOwnPersonal.optional(),medical:hrOwnMedical.optional()}).strict();
type Section = "personal" | "medical";
const object = (value: unknown): Record<string,unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : null;

// Compare only submitted fields: unrelated employment/holiday/medical updates must
// not invalidate an address change, and unchanged form fields must not revert edits.
export function reviewHrProposal(details: Record<string,unknown>, current: {personal:unknown;medical:unknown;version:number}) {
  const parsed = proposalSchema.safeParse(details.proposed);
  if (!parsed.success || !Object.values(parsed.data).some(section=>section && Object.keys(section).length)) {
    throw new RequestError("The proposed profile details are invalid. Ask the employee to submit updated details.",422);
  }
  const before = object(details.before);
  const result: Partial<Record<Section,Record<string,unknown>>> = {};
  for (const section of ["personal","medical"] as const) {
    const proposed = parsed.data[section];
    if (!proposed) continue;
    const original = object(before?.[section]);
    const latest = object(current[section]) || {};
    const changes: Record<string,unknown> = {};
    for (const [field,value] of Object.entries(proposed)) {
      const hasBefore = !!original && Object.prototype.hasOwnProperty.call(original,field);
      // A submitted form can include unchanged values. These are not edits.
      if (hasBefore && isDeepStrictEqual(original[field],value)) continue;
      if (isDeepStrictEqual(latest[field] ?? null,value)) continue;
      if (current.version !== details.baseVersion && (!hasBefore || !isDeepStrictEqual(latest[field] ?? null,original![field] ?? null))) {
        throw new RequestError("Some of these profile details have changed since submission. Ask the employee to submit updated details so newer changes are not overwritten.",409);
      }
      changes[field]=value;
    }
    if (Object.keys(changes).length) result[section]=changes;
  }
  return result;
}
