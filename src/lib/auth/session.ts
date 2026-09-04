import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { db } from "@/db";
import { sessions, users, userRoles } from "@/db/schema";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  businessId: string | null;
  roles: string[];
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      businessId: users.businessId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, row.userId));

  return {
    id: row.userId,
    email: row.email,
    businessId: row.businessId,
    roles: roles.map((r) => r.role),
  };
}

export async function destroySession(): Promise<void> {
  const token = getCookie(COOKIE_NAME);
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function newId(): string {
  return randomUUID();
}
