import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { safeEqual, sha256 } from "./security";

export type DeviceAuthenticationResult =
  | { ok: true; device: NonNullable<Awaited<ReturnType<typeof prisma.device.findUnique>>> }
  | { ok: false; status: 401 | 403; category: "device-auth-missing" | "device-auth-invalid" | "device-revoked" };

export async function authenticateDeviceDetailed(req: NextRequest): Promise<DeviceAuthenticationResult> {
  const id = req.headers.get("x-device-id");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!id || !token) return { ok: false, status: 401, category: "device-auth-missing" };
  if (id === "development-device" && token === "development-token" && process.env.NODE_ENV !== "production") {
    const device = await prisma.device.findFirst({ where: { isSeedData: true } });
    return device ? { ok: true, device } : { ok: false, status: 401, category: "device-auth-invalid" };
  }
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return { ok: false, status: 401, category: "device-auth-invalid" };
  if (device.status === "REVOKED") return { ok: false, status: 403, category: "device-revoked" };
  if (device.status !== "ACTIVE" || !safeEqual(device.tokenHash, sha256(token))) {
    return { ok: false, status: 401, category: "device-auth-invalid" };
  }
  return { ok: true, device };
}
export async function authenticateDevice(req: NextRequest) {
  const id = req.headers.get("x-device-id");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!id || !token) return null;
  if (id === "development-device" && token === "development-token" && process.env.NODE_ENV !== "production") {
    return prisma.device.findFirst({ where: { isSeedData: true } });
  }
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.status !== "ACTIVE" || !safeEqual(device.tokenHash, sha256(token))) return null;
  return device;
}
