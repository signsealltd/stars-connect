import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const payrollRoute = readFileSync("src/app/api/payroll/periods/[id]/route.ts", "utf8");
const billingRoute = readFileSync("src/app/api/billing/runs/[id]/route.ts", "utf8");
const consoleUi = readFileSync("src/components/simple-finance-console.tsx", "utf8");
const reviewUi = readFileSync("src/components/simple-finance-run-review.tsx", "utf8");
const seasonalArt = readFileSync("src/components/seasonal-screensaver-art.tsx", "utf8");

describe("financial run management", () => {
  it("requires password re-authentication and preserves a deletion audit event", () => {
    for (const [route, action] of [[payrollRoute, "PAYROLL_RUN_DELETED"], [billingRoute, "BILLING_RUN_DELETED"]] as const) {
      expect(route).toContain("export async function DELETE");
      expect(route).toContain("bcrypt.compare");
      expect(route).toContain(action);
      expect(route.indexOf("delete({where:{id}})")).toBeLessThan(route.indexOf(`audit("${action}"`));
    }
    expect(consoleUi).toContain('autoComplete="current-password"');
    expect(consoleUi).toContain("Delete permanently");
  });

  it("adds itemised invoice services and recalculates them server-side", () => {
    expect(reviewUi).toContain("Add an invoice service");
    expect(reviewUi).toContain("Service description");
    expect(reviewUi).toContain("Add service and recalculate");
    expect(billingRoute).toContain("calculateInvoiceServiceLine(quantity,unitRate,vatRate)");
    expect(billingRoute).toContain('audit("BILLING_SERVICE_LINE_ADDED"');
  });

  it("uses illustrated vector scenes rather than generic seasonal particles", () => {
    expect(seasonalArt).toContain("haunted-house");
    expect(seasonalArt).toContain("pumpkin-candle-glow");
    expect(seasonalArt).toContain("christmas-bulb");
    expect(seasonalArt).toContain("leprechaun");
    expect(seasonalArt).not.toContain("confetti");
  });
});
