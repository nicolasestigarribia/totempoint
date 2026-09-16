/**
 * Borra TODOS los usuarios y deja un único superadmin.
 *
 * Alcance: users, sessions, user_roles, user_locations. No toca empresas,
 * locales ni catálogo (si querés vaciar también eso, se hace aparte).
 *
 * Correr con:  bun run src/db/reset-users.ts
 * Apunta a la DATABASE_URL de .env.local, que es la base compartida de Railway.
 * Es destructivo y no se puede deshacer.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { users, userRoles } from "./schema";
import { hashPassword } from "@/lib/auth/password";

const email = (process.env.SEED_EMAIL ?? "superadmin@totempoint.com").toLowerCase();
const username = (process.env.SEED_USERNAME ?? "superadmin").toLowerCase();
const password = process.env.SEED_PASSWORD ?? "1234";

async function main() {
  console.log("Borrando usuarios, sesiones, roles y asignaciones de locales...");
  await db.execute(sql`DELETE FROM user_locations`);
  await db.execute(sql`DELETE FROM user_roles`);
  await db.execute(sql`DELETE FROM sessions`);
  await db.execute(sql`DELETE FROM users`);
  console.log("Listo, no queda ningún usuario.");

  const [{ id: userId }] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash: await hashPassword(password),
      companyId: null,
      locationId: null,
      active: true,
    })
    .$returningId();

  await db.insert(userRoles).values({ userId, role: "superadmin" });

  console.log(`\nSuperadmin creado (id ${userId}).`);
  console.log(`  email:    ${email}`);
  console.log(`  usuario:  ${username}`);
  console.log(`  password: ${password}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
