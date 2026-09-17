/**
 * Crea user_permissions: qué puede hacer cada operador en cada sección del
 * panel. Sin fila, la sección no le aparece; "ver" es solo lectura y "editar"
 * le deja modificar. El dueño y el superadmin no llevan filas: pueden todo.
 *
 * Los encargados que ya existían quedan sin permisos, así que hay que abrirles
 * las secciones desde Operadores. Es a propósito: es más seguro empezar cerrado.
 *
 * Correr con:  bun run src/db/migrate-permissions.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      section ENUM('portada','categorias','productos','combos','ingredientes',
                   'disponibilidad','stock','movimientos','codigos','comandera') NOT NULL,
      level ENUM('ver','editar') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_permissions_user_section_uq (user_id, section)
    )
  `);
  console.log("Tabla user_permissions lista.");

  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM user_roles WHERE role IN ('encargado','kitchen')`,
  )) as unknown as [Array<{ n: number }>];
  const n = Number(rows[0]?.n ?? 0);
  if (n > 0) {
    console.log(
      `\nOjo: hay ${n} operador(es) sin permisos todavía. Entrá a Operadores y asignáselos.`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
