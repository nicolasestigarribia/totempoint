import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";

export interface AuthUser {
  id: string;
  email: string;
  businessId: string | null;
  roles: string[];
}

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email(),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<AuthUser> => {
    const email = data.email.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new Error("Email o contraseña incorrectos");
    }

    await createSession(user.id);

    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    return {
      id: user.id,
      email: user.email,
      businessId: user.businessId,
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
