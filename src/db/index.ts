import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL no está definida");
}

// Los scripts de src/db/ (migraciones, seeds) dicen contra qué base corren. Hay
// dos en el mismo servidor: `totempoint_test`, la de `.env.local`, para probar;
// y `railway`, la de producción, que solo se toca a propósito con
// `bun --env-file=.env.produccion.local run src/db/<script>.ts`.
const esScript = /[\\/]src[\\/]db[\\/]/.test(process.argv[1] ?? "");
if (esScript) {
  const base = new URL(url).pathname.slice(1);
  console.log(
    base === "railway"
      ? "⚠️  Base de PRODUCCIÓN (railway): esto cambia los datos reales."
      : `Base: ${base}`,
  );
}

const pool = mysql.createPool({
  uri: url,
  connectionLimit: 5,
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
