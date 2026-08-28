import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normaliseTrainingRole, trainingState, type RequirementRules } from "@/lib/training-matrix";

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async () => {
    const [staff, courses, records] = await Promise.all([
      prisma.staffMember.findMany({ where: { active: true, archivedAt: null }, select: { id: true, firstName: true, lastName: true, displayName: true, jobRole: true }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] }),
      prisma.trainingCourse.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.staffTrainingRecord.findMany({ where: { active: true }, orderBy: { completedDate: "desc" } }),
    ]);
    const rows = staff.map(person => {
      const role = normaliseTrainingRole(person.jobRole);
      const cells = courses.map(course => {
        const rules = course.requirementRules as RequirementRules;
        const requirement = rules[role] || "CONDITIONAL";
        const record = records.find(row => row.staffId === person.id && (row.courseId === course.id || row.courseName.toLowerCase() === course.name.toLowerCase()));
        return { courseId: course.id, requirement, recordId: record?.id || null, completedDate: record?.completedDate || null, expiryDate: record?.expiryDate || null, state: trainingState({ requirement, completedDate: record?.completedDate, expiryDate: record?.expiryDate }, new Date(), course.warningDays) };
      });
      return { id: person.id, name: `${person.firstName} ${person.lastName}`.trim() || person.displayName, role, cells };
    });
    const counts = rows.flatMap(row => row.cells).reduce<Record<string, number>>((all, cell) => {
      all[cell.state] = (all[cell.state] || 0) + 1;
      return all;
    }, {});
    return NextResponse.json({ courses: courses.map(({ id, name, category, warningDays }) => ({ id, name, category, warningDays })), rows, counts });
  });
}
