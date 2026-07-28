import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mutationOriginAllowed, requestContext } from "./api";
import { clearRateLimitsForTests, rateLimit } from "./rate-limit";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "./security";
import { CAPABILITIES, hasCapability } from "./permissions";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
  clearRateLimitsForTests();
});

describe("session policy", () => {
  it("uses a shorter idle timeout than its absolute lifetime", () => {
    expect(SESSION_IDLE_MS).toBe(30 * 60 * 1000);
    expect(SESSION_ABSOLUTE_MS).toBe(8 * 60 * 60 * 1000);
    expect(SESSION_IDLE_MS).toBeLessThan(SESSION_ABSOLUTE_MS);
  });
});

describe("request trust and CSRF policy", () => {
  it("does not trust forwarded addresses by default", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const req = new NextRequest("https://app.example.test/api/test", {
      headers: { "x-forwarded-for": "198.51.100.9, 10.0.0.1" },
    });
    expect(requestContext(req).ipAddress).toBeUndefined();
  });

  it("selects the client address relative to explicitly trusted proxy hops", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const req = new NextRequest("https://app.example.test/api/test", {
      headers: { "x-forwarded-for": "198.51.100.9, 10.0.0.1" },
    });
    expect(requestContext(req).ipAddress).toBe("10.0.0.1");
  });

  it("rejects a cross-origin production mutation", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_URL = "https://app.example.test";
    const req = new NextRequest("https://app.example.test/api/test", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    expect(mutationOriginAllowed(req)).toBe(false);
  });
});

describe("bounded rate limiting", () => {
  it("blocks requests over the configured limit", () => {
    expect(rateLimit("login:test", 2).allowed).toBe(true);
    expect(rateLimit("login:test", 2).allowed).toBe(true);
    expect(rateLimit("login:test", 2).allowed).toBe(false);
  });
});

describe("sensitive visitor capabilities", () => {
  it("keeps contact details and signatures unavailable to reception", () => {
    expect(hasCapability("RECEPTION", CAPABILITIES.VISITOR_CONTACT_VIEW)).toBe(false);
    expect(hasCapability("RECEPTION", CAPABILITIES.VISITOR_SIGNATURE_VIEW)).toBe(false);
  });
});
