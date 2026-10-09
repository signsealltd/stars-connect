import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normaliseTrainingRole, trainingState, effectiveTrainingRequirement, mandatoryTrainingCounts, type RequirementRules } from "@/lib/training-matrix";

import { trainingRecordMatchesCourse } from "@/lib/training-catalogue";

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async () => {
    const [staff, courses, records, assignments] = await Promise.all([
      prisma.staffMember.findMany({ where: { active: true, archivedAt: null }, select: { id: true, firstName: true, lastName: true, displayName: true, jobRole: true }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] }),
      prisma.trainingCourse.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.staffTrainingRecord.findMany({ where: { active: true }, orderBy: { completedDate: "desc" } }),
      prisma.staffTrainingAssignment.findMany(),
    ]);
    const rows = staff.map(person => {
      const role = normaliseTrainingRole(person.jobRole);
      const cells = courses.map(course => {
        const rules = course.requirementRules as RequirementRules;
        const assignment = assignments.find(a => a.staffId === person.id && a.courseId === course.id);
        const requirement = effectiveTrainingRequirement(rules[role] || "CONDITIONAL", assignment?.required);
        const record = records.find(row => row.staffId === person.id && trainingRecordMatchesCourse(row, course));
        return { courseId: course.id, requirement, assignment: assignment?.required ?? null, assignmentReason: assignment?.reason ?? "", recordId: record?.id || null, completedDate: record?.completedDate || null, expiryDate: record?.expiryDate || null, state: trainingState({ requirement, completedDate: record?.completedDate, expiryDate: record?.expiryDate }, new Date(), course.warningDays) };
      });
      return { id: person.id, name: `${person.firstName} ${person.lastName}`.trim() || person.displayName, role, cells };
    });
    const counts = mandatoryTrainingCounts(rows.flatMap(row => row.cells));
    return NextResponse.json({ courses: courses.map(({ id, name, category, warningDays }) => ({ id, name, category, warningDays })), rows, counts });
  });
}
