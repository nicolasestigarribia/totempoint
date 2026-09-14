import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser, type SessionUser } from "./session";

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("No autorizado: iniciá sesión");
    }
    return next({ context: { user } });
  },
);

export const requireSuperadmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const user = context.user as SessionUser;
    if (!user.roles.includes("superadmin")) {
      throw new Error("No autorizado: se requiere rol superadmin");
    }
    return next({ context: { user } });
  });
