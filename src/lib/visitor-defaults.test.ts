import { describe, expect, it, vi } from "vitest";
import { defaultVisitorReasons, ensureVisitorConfiguration } from "./visitor-defaults";

describe("ensureVisitorConfiguration", () => {
  it("restores safe visitor defaults when launch cleanup has removed them", async () => {
    const reasonUpsert = vi.fn().mockResolvedValue({});
    const rulesUpsert = vi.fn().mockResolvedValue({ id: "rules-1", version: 1, active: true });
    const settingUpsert = vi.fn().mockResolvedValue({});
    const client = {
      visitorReason: { count: vi.fn().mockResolvedValue(0), upsert: reasonUpsert },
      visitorRuleSet: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        upsert: rulesUpsert,
      },
      appSetting: { upsert: settingUpsert },
    };

    const rules = await ensureVisitorConfiguration(client as never);

    expect(reasonUpsert).toHaveBeenCalledTimes(defaultVisitorReasons.length);
    expect(reasonUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { label: "Electrical" },
      create: expect.objectContaining({ label: "Electrical", active: true }),
    }));
    expect(rulesUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { version: 1 },
      create: expect.objectContaining({ version: 1, active: true }),
    }));
    expect(settingUpsert).toHaveBeenCalledTimes(7);
    expect(rules).toEqual(expect.objectContaining({ id: "rules-1", active: true }));
  });

  it("keeps existing configuration and only fills missing settings", async () => {
    const existingRules = { id: "rules-9", version: 9, active: true };
    const client = {
      visitorReason: { count: vi.fn().mockResolvedValue(3), upsert: vi.fn() },
      visitorRuleSet: {
        findFirst: vi.fn().mockResolvedValue(existingRules),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      appSetting: { upsert: vi.fn().mockResolvedValue({}) },
    };

    const rules = await ensureVisitorConfiguration(client as never);

    expect(client.visitorReason.upsert).not.toHaveBeenCalled();
    expect(client.visitorRuleSet.update).not.toHaveBeenCalled();
    expect(client.visitorRuleSet.upsert).not.toHaveBeenCalled();
    expect(rules).toBe(existingRules);
  });
});
