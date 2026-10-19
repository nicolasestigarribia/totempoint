/**
 * Deja la base sin pedidos: para empezar de cero antes de mostrarle el sistema
 * a un cliente, o después de probar con pedidos de mentira.
 *
 * Borra los pedidos y todo lo que cuelga de ellos (ítems, lo sacado, los
 * extras, los gustos elegidos), los movimientos de stock de esas ventas y el
 * contador de números, así el próximo pedido de cada sucursal es el 1. Antes
 * devuelve al stock lo que esas ventas habían descontado (`vp_local`), para
 * que el inventario no quede corrido. No toca productos, clientes registrados,
 * stock cargado a mano ni la auditoría.
 *
 * Por defecto solo cuenta. Con --aplicar guarda primero una copia de todo lo
 * que borra en el archivo de --respaldo (obligatorio) y después borra, todo en
 * una transacción. Con --empresa=<slug> se limita a esa empresa.
 *
 *   bun run src/db/limpiar-pedidos.ts
 *   bun run src/db/limpiar-pedidos.ts --aplicar --respaldo=/ruta/respaldo.json
 *   (producción: bun --env-file=.env.produccion.local run src/db/limpiar-pedidos.ts ...)
 */
import { writeFileSync } from "node:fs";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./index";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const respaldo = args.find((a) => a.startsWith("--respaldo="))?.slice("--respaldo=".length);
const empresa = args.find((a) => a.startsWith("--empresa="))?.slice("--empresa=".length);

const filas = async (q: SQL) => (await db.execute(q))[0] as unknown as Record<string, unknown>[];

async function main() {
  // Las sucursales alcanzadas: todas, o las de una empresa.
  const sucursales = (
    await filas(
      empresa
        ? sql`SELECT l.id FROM locations l JOIN companies c ON c.id = l.company_id WHERE c.slug = ${empresa}`
        : sql`SELECT id FROM locations`,
    )
  ).map((f) => Number(f.id));
  if (empresa && sucursales.length === 0) throw new Error(`No hay una empresa "${empresa}"`);
  if (sucursales.length === 0) {
    console.log("No hay sucursales.");
    process.exit(0);
  }
  const enSucursales = sql`(${sql.join(
    sucursales.map((id) => sql`${id}`),
    sql`, `,
  )})`;

  const pedidos = await filas(sql`SELECT * FROM orders WHERE location_id IN ${enSucursales}`);
  const ids = pedidos.map((p) => Number(p.id));
  console.log(`${empresa ? `Empresa ${empresa}` : "Todas las empresas"}: ${ids.length} pedidos.`);
  if (ids.length === 0) process.exit(0);
  const enPedidos = sql`(${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;

  const items = await filas(sql`SELECT * FROM order_items WHERE order_id IN ${enPedidos}`);
  const itemIds = items.map((i) => Number(i.id));
  const enItems = itemIds.length
    ? sql`(${sql.join(
        itemIds.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql`(NULL)`;
  const [sacados, extras, elecciones, movimientos, contadores] = await Promise.all([
    filas(sql`SELECT * FROM order_item_removals WHERE order_item_id IN ${enItems}`),
    filas(sql`SELECT * FROM order_item_extras WHERE order_item_id IN ${enItems}`),
    filas(sql`SELECT * FROM order_item_elecciones WHERE order_item_id IN ${enItems}`),
    filas(sql`SELECT * FROM movements WHERE order_id IN ${enPedidos}`),
    filas(sql`SELECT * FROM order_sequences WHERE location_id IN ${enSucursales}`),
  ]);
  console.log(
    `Ítems ${items.length}, sacados ${sacados.length}, extras ${extras.length}, gustos ${elecciones.length}, movimientos de venta ${movimientos.length}, contadores ${contadores.length}.`,
  );

  if (!aplicar) {
    console.log("Solo conté. Para borrar: --aplicar --respaldo=<archivo.json>");
    process.exit(0);
  }
  if (!respaldo) throw new Error("Falta --respaldo=<archivo.json>: no se borra sin copia");

  writeFileSync(
    respaldo,
    JSON.stringify(
      {
        hecho: new Date().toISOString(),
        empresa: empresa ?? null,
        pedidos,
        items,
        sacados,
        extras,
        elecciones,
        movimientos,
        contadores,
      },
      null,
      1,
    ),
  );
  console.log(`Copia guardada en ${respaldo}`);

  await db.transaction(async (tx) => {
    // Lo que las ventas dejaron descontado, neto de las anuladas, se devuelve
    // a vp_local. Solo lo posterior al conteo inicial: lo anterior ya no está
    // en vp_local (el primer ingreso lo reinició).
    await tx.execute(sql`
      UPDATE artistock a
      JOIN (
        SELECT m.location_id, m.ingredient_id, m.product_id, -SUM(m.amount) AS neto
        FROM movements m
        JOIN artistock s ON s.location_id = m.location_id
          AND (s.ingredient_id <=> m.ingredient_id) AND (s.product_id <=> m.product_id)
        WHERE m.order_id IN ${enPedidos} AND m.type = 'stock'
          AND (s.control_desde IS NULL OR m.created_at >= s.control_desde)
        GROUP BY m.location_id, m.ingredient_id, m.product_id
      ) v ON v.location_id = a.location_id
        AND (v.ingredient_id <=> a.ingredient_id) AND (v.product_id <=> a.product_id)
      SET a.vp_local = GREATEST(a.vp_local - v.neto, 0)
    `);
    await tx.execute(sql`DELETE FROM movements WHERE order_id IN ${enPedidos}`);
    if (itemIds.length) {
      await tx.execute(sql`DELETE FROM order_item_removals WHERE order_item_id IN ${enItems}`);
      await tx.execute(sql`DELETE FROM order_item_extras WHERE order_item_id IN ${enItems}`);
      await tx.execute(sql`DELETE FROM order_item_elecciones WHERE order_item_id IN ${enItems}`);
      await tx.execute(sql`DELETE FROM order_items WHERE id IN ${enItems}`);
    }
    await tx.execute(sql`DELETE FROM orders WHERE id IN ${enPedidos}`);
    await tx.execute(sql`DELETE FROM order_sequences WHERE location_id IN ${enSucursales}`);
  });

  const [{ n }] = await filas(
    sql`SELECT COUNT(*) AS n FROM orders WHERE location_id IN ${enSucursales}`,
  );
  console.log(`Listo. Quedan ${n} pedidos.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
