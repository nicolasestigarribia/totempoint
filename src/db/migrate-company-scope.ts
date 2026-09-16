/**
 * Ingredientes, categorías de ingredientes y códigos de acción dejan de poder
 * ser "globales": pasan a ser siempre de una empresa.
 *
 *  1. company_id pasa a NOT NULL en las tres tablas.
 *  2. El código de acción deja de ser único en toda la plataforma y pasa a ser
 *     único dentro de cada empresa, para que dos empresas puedan tener el mismo.
 *
 * Correr con:  bun run src/db/migrate-company-scope.ts
 * Apunta a la DATABASE_URL de .env.local, que es la base compartida de Railway.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function countGlobals(table: string): Promise<number> {
  const [rows] = (await db.execute(
    sql.raw(`SELECT COUNT(*) AS n FROM ${table} WHERE company_id IS NULL`),
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0);
}

async function indexesOn(table: string, column: string): Promise<string[]> {
  const [rows] = (await db.execute(
    sql`SELECT index_name AS name, COUNT(*) AS cols
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ${table}
        GROUP BY index_name
        HAVING SUM(column_name = ${column}) > 0 AND COUNT(*) = 1`,
  )) as unknown as [Array<{ name: string }>];
  return rows.map((r) => r.name).filter((n) => n !== "PRIMARY");
}

async function main() {
  // Si quedara alguna fila global, la migración pararía acá en vez de romper el ALTER.
  for (const table of ["ingredients", "ingredient_categories", "action_codes"]) {
    const n = await countGlobals(table);
    if (n > 0) {
      throw new Error(
        `${table} todavía tiene ${n} fila(s) con company_id NULL. Asignalas a una empresa o borralas antes de migrar.`,
      );
    }
  }

  console.log("1/4 · ingredients.company_id NOT NULL");
  await db.execute(sql`ALTER TABLE ingredients MODIFY COLUMN company_id INT NOT NULL`);

  console.log("2/4 · ingredient_categories.company_id NOT NULL");
  await db.execute(sql`ALTER TABLE ingredient_categories MODIFY COLUMN company_id INT NOT NULL`);

  console.log("3/4 · action_codes.company_id NOT NULL");
  await db.execute(sql`ALTER TABLE action_codes MODIFY COLUMN company_id INT NOT NULL`);

  console.log("4/4 · action_codes: el código es único por empresa");
  for (const name of await indexesOn("action_codes", "code")) {
    console.log(`     borrando índice viejo ${name}`);
    await db.execute(sql.raw(`ALTER TABLE action_codes DROP INDEX \`${name}\``));
  }
  const existing = await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'action_codes'
          AND index_name = 'action_codes_company_code_uq'`,
  );
  const [rows] = existing as unknown as [Array<{ n: number }>];
  if (Number(rows[0]?.n ?? 0) === 0) {
    await db.execute(
      sql`ALTER TABLE action_codes ADD UNIQUE KEY action_codes_company_code_uq (company_id, code)`,
    );
    console.log("     índice (company_id, code) creado");
  } else {
    console.log("     el índice ya existía");
  }

  console.log("\nMigración terminada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
