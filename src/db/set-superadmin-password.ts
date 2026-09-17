/**
 * Cambia la contraseña del superadmin. La contraseña la elegís vos: el script
 * no genera ninguna ni la deja escrita en el repositorio.
 *
 * Correr con:
 *   SEED_PASSWORD="la-que-elijas" bun run src/db/set-superadmin-password.ts
 *
 * Opcionalmente SEED_EMAIL para elegir a qué superadmin, si hubiera varios.
 * Al cambiarla se cierran todas sus sesiones abiertas, así que hay que volver
 * a entrar en cada dispositivo.
 */
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { users, userRoles, sessions } from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { checkPassword, PASSWORD_HINT } from "@/lib/auth/password-policy";

const password = process.env.SEED_PASSWORD;
const email = process.env.SEED_EMAIL?.toLowerCase();

async function main() {
  if (!password || password.length < 8) {
    throw new Error(
      'Pasá la contraseña nueva en SEED_PASSWORD, de 8 caracteres o más:\n  SEED_PASSWORD="..." bun run src/db/set-superadmin-password.ts',
    );
  }

  const rows = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "superadmin")));

  const target = email ? rows.find((r) => r.email === email) : rows[0];
  if (!target) {
    throw new Error(
      email ? `No hay un superadmin con el email ${email}` : "No hay ningún superadmin",
    );
  }
  if (!email && rows.length > 1) {
    throw new Error(
      `Hay ${rows.length} superadmins: elegí uno con SEED_EMAIL (${rows.map((r) => r.email).join(", ")})`,
    );
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, target.id));

  const [res] = (await db.delete(sessions).where(eq(sessions.userId, target.id))) as unknown as [
    { affectedRows: number },
  ];

  console.log(`Contraseña cambiada para ${target.username ?? target.email} (${target.email}).`);
  console.log(`Se cerraron ${res?.affectedRows ?? 0} sesión(es) abiertas: volvé a entrar.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
