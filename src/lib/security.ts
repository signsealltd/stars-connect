import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "stars_connect_session";
const LEGACY_SESSION_COOKIE = "pulse_session";
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const SESSION_TOUCH_MS = 5 * 60 * 1000;

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403, message: "AUTHENTICATION_REQUIRED" | "FORBIDDEN") { super(message); }
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
      lastSeenAt: new Date(),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
  return token;
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date();
  const tokenHash = sha256(token);
  const session = await prisma.session.findFirst({
    where: { tokenHash, expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_MS) }, user: { active: true } },
    include: { user: true },
  });
  if (!session) { await prisma.session.deleteMany({ where: { tokenHash } }); return null; }
  if (session.lastSeenAt.getTime() < now.getTime() - SESSION_TOUCH_MS) {
    await prisma.session.updateMany({ where: { id: session.id, lastSeenAt: session.lastSeenAt }, data: { lastSeenAt: now } });
  }
  return session;
}

const rank: Record<Role, number> = {
  RECEPTION: 1,
  MANAGER: 2,
  ADMINISTRATOR: 4,
  DIRECTOR: 3,
};

export async function requireRole(role: Role = "RECEPTION") {
  const session = await getSession();
  if (!session) throw new AccessError(401, "AUTHENTICATION_REQUIRED");
  if (rank[session.user.role] < rank[role]) throw new AccessError(403, "FORBIDDEN");
  return session.user;
}

export async function revokeAllUserSessions(userId: string) {
  return prisma.session.deleteMany({ where: { userId } });
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
