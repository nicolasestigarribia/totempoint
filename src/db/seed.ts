import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, userRoles } from "./schema";
import { hashPassword } from "@/lib/auth/password";

const email = (process.env.SEED_EMAIL ?? "superadmin@totempoint.com").toLowerCase();
const password = process.env.SEED_PASSWORD ?? "Totem-Admin-2026";

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let userId: number;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, userId));
    console.log(`Usuario ${email} ya existía — contraseña actualizada.`);
  } else {
    const [inserted] = await db
      .insert(users)
      .values({
        email,
        passwordHash: await hashPassword(password),
      })
      .$returningId();
    userId = inserted.id;
    console.log(`Usuario ${email} creado.`);
  }

  await db
    .insert(userRoles)
    .values({ userId, role: "superadmin" })
    .onDuplicateKeyUpdate({ set: { role: "superadmin" } });

  console.log("Rol superadmin asignado.");
  console.log(`\n  Login → email: ${email}\n         password: ${password}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
