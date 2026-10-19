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

// Producción y pruebas comparten un MySQL con 151 conexiones como máximo, y
// el 6/10/2026 se llenó: el servidor de desarrollo creaba un pool nuevo en
// cada recarga del código sin cerrar el anterior, y cada despliegue dejaba las
// conexiones del contenedor viejo abiertas hasta que MySQL las vencía. Por eso
// las que no se usan se cierran solas (`idleTimeout`, por debajo del
// `wait_timeout` del servidor) y en desarrollo el pool sobrevive a las recargas.
const global_ = globalThis as unknown as { __totempointPool?: mysql.Pool };
const pool =
  global_.__totempointPool ??
  mysql.createPool({
    uri: url,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });
if (process.env.NODE_ENV !== "production") global_.__totempointPool = pool;

// Una conexión del pool puede estar muerta sin que el pool lo sepa: MySQL la
// cerró, se reinició, o la máquina estuvo suspendida. La primera consulta que
// la toma falla, el pool la descarta, y la siguiente anda. Para que ese primer
// cliente no vea un error, una LECTURA que falla por conexión cortada se
// reintenta una vez. Las escrituras no: si la conexión se cayó después de
// guardar, reintentar duplicaría el pedido.
const CONEXION_CORTADA = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "PROTOCOL_SEQUENCE_TIMEOUT",
]);
type ConReintento = mysql.Pool & { __conReintento?: boolean };
const conReintento = pool as ConReintento;
if (!conReintento.__conReintento) {
  conReintento.__conReintento = true;
  for (const metodo of ["query", "execute"] as const) {
    const original = pool[metodo].bind(pool) as (...args: unknown[]) => Promise<unknown>;
    (pool as unknown as Record<string, unknown>)[metodo] = async (...args: unknown[]) => {
      try {
        return await original(...args);
      } catch (err) {
        const codigo = (err as { code?: string }).code ?? "";
        const sentencia =
          typeof args[0] === "string" ? args[0] : ((args[0] as { sql?: string })?.sql ?? "");
        if (CONEXION_CORTADA.has(codigo) && /^\s*(select|with)\b/i.test(sentencia)) {
          return original(...args);
        }
        throw err;
      }
    };
  }
}

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
