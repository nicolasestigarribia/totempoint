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

/** Usuario que pertenece a una empresa: owner o encargado. */
export const requireCompany = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) {
      throw new Error(
        user.roles.includes("superadmin")
          ? "Elegí una empresa desde el panel de superadmin"
          : "No autorizado: tu usuario no pertenece a ninguna empresa",
      );
    }
    return next({ context: { user } });
  });

/** Solo el dueño de la empresa. Da de alta encargados y les asigna locales. */
export const requireOwner = createMiddleware({ type: "function" })
  .middleware([requireCompany])
  .server(async ({ next, context }) => {
    const user = context.user as SessionUser;
    // El superadmin tiene acceso a todo, incluido el panel de cada empresa.
    if (!user.roles.includes("owner") && !user.roles.includes("superadmin")) {
      throw new Error("No autorizado: se requiere ser dueño de la empresa");
    }
    return next({ context: { user } });
  });

export const requireSuperadmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const user = context.user as SessionUser;
    if (!user.roles.includes("superadmin")) {
      throw new Error("No autorizado: se requiere rol superadmin");
    }
    return next({ context: { user } });
  });
