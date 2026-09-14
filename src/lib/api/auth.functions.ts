import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";

export interface AuthUser {
  id: number;
  email: string;
  companyId: number | null;
  locationId: number | null;
  roles: string[];
}

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      identifier: z.string().trim().min(1),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<AuthUser> => {
    const identifier = data.identifier.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .limit(1);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    await createSession(user.id);

    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    return {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      locationId: user.locationId,
      roles: roles.map((r) => r.role),
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthUser | null> => {
    return getSessionUser();
  },
);
