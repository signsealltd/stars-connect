import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { safeEqual, sha256 } from "./security";

export async function authenticateDevice(req: NextRequest) {
  const id = req.headers.get("x-device-id");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!id || !token) return null;
  if (id === "development-device" && token === "development-token" && process.env.NODE_ENV !== "production") {
    return prisma.device.findFirst({ where: { status: "ACTIVE" } });
  }
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.status !== "ACTIVE" || !safeEqual(device.tokenHash, sha256(token))) return null;
  return device;
}
