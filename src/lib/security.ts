import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "stars_connect_session";
const LEGACY_SESSION_COOKIE = "pulse_session";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return token;
}

export async function getSession() {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (!token) return null;
  return prisma.session.findFirst({
    where: { tokenHash: sha256(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

const rank: Record<Role, number> = {
  RECEPTION: 1,
  MANAGER: 2,
  ADMINISTRATOR: 3,
};

export async function requireRole(role: Role = "RECEPTION") {
  const session = await getSession();
  if (!session || !session.user.active || rank[session.user.role] < rank[role]) {
    throw new Error("UNAUTHORISED");
  }
  return session.user;
}

export async function endSession() {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(LEGACY_SESSION_COOKIE);
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
