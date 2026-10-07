/**
 * Carga la carta real de PrimoRosas (octubre 2026), tal como se la pasan a los
 * clientes por WhatsApp: borra el catálogo anterior —productos, combos,
 * categorías y sus precios por sucursal— y carga el nuevo, con stock inicial
 * grande para que puedan empezar a vender sin cargar inventario.
 *
 * Los pedidos viejos no se tocan: `order_items` congela nombre y precio, así
 * que siguen diciendo lo mismo. Los ingredientes tampoco.
 *
 * Probar:      bun run src/db/cargar-menu-primorosas.ts
 * Producción:  bun --env-file=.env.produccion.local run src/db/cargar-menu-primorosas.ts --si
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

const SLUG = "sangucheria-primorosas";
/** Stock con que arranca cada sándwich. Lo ajustan desde Stock cuando quieran. */
const STOCK_INICIAL = 1000;

type Pan = "blanco" | "negro" | "ambos" | null;
const B: Pan = "blanco";
const N: Pan = "negro";
const BN: Pan = "ambos";

// La bajada de las categorías de miga y su regalo, tal como lo explica el local.
const MIGA =
  "Sándwiches de miga cuadrados y triples, grandes como dos de miga tradicionales. Cada 12 van 2 más de regalo. Calculamos 2 por persona para almuerzo o cena.";
const REGALO_MIGA = { cada: 12, cantidad: 2 };

interface Item {
  n: number | null;
  nombre: string;
  pan: Pan;
  descripcion?: string;
  activo?: boolean;
}

interface Categoria {
  nombre: string;
  tagline: string;
  precio: number;
  foto: string;
  items: (Item & { precio?: number })[];
}

const CARTA: Categoria[] = [
  {
    nombre: "Clásicos",
    tagline: MIGA,
    precio: 8000,
    foto: "/img/207",
    items: [
      { n: 1, nombre: "Jamón y queso", pan: BN },
      { n: 2, nombre: "Jamón y aceitunas", pan: B },
      { n: 3, nombre: "Jamón y tomate", pan: B },
      { n: 4, nombre: "Jamón y huevo", pan: BN },
      { n: 5, nombre: "Jamón, tomate, orégano y oliva", pan: N },
      { n: 6, nombre: "Jamón, tomate y huevo", pan: BN },
      { n: 7, nombre: "Jamón, zanahoria y huevo", pan: B },
      { n: 8, nombre: "Jamón, choclo y huevo", pan: B },
      { n: 9, nombre: "Queso y tomate", pan: B },
      { n: 10, nombre: "Queso, tomate y albahaca", pan: BN },
      { n: 11, nombre: "Queso, zanahoria y huevo", pan: N },
      { n: 12, nombre: "Queso, remolacha y huevo", pan: N },
      { n: 13, nombre: "Queso, choclo y huevo", pan: N },
      { n: 14, nombre: "Queso y queso", pan: B },
      { n: 15, nombre: "Queso, aceitunas y huevo", pan: BN },
      { n: 16, nombre: "Queso, mix de hojas y huevo con semillas", pan: N },
      { n: 17, nombre: "Tomate, rúcula, remolacha y zanahoria", pan: N },
      { n: 18, nombre: "Salame y queso", pan: B },
    ],
  },
  {
    nombre: "Especiales",
    tagline: MIGA,
    precio: 10000,
    foto: "/img/208",
    items: [
      { n: 19, nombre: "Jamón, rúcula y cherry", pan: N },
      { n: 20, nombre: "Jamón, champiñón y parmesano", pan: N },
      { n: 21, nombre: "Jamón, palmitos y salsa golf", pan: BN },
      { n: 22, nombre: "Jamón y ananá", pan: BN },
      { n: 23, nombre: "Jamón y roquefort", pan: BN },
      { n: 24, nombre: "Jamón, morrón y huevo", pan: BN },
      { n: 25, nombre: "Queso, rúcula y tomate", pan: N },
      { n: 26, nombre: "Queso, atún en lomos y huevo", pan: BN },
      { n: 27, nombre: "Queso, tomate, palmitos y salsa golf", pan: N },
      { n: 28, nombre: "Queso, brócoli y huevo", pan: N },
      { n: 29, nombre: "Jamón crudo y queso", pan: N },
      { n: 30, nombre: "Jamón crudo y tomate", pan: N },
      { n: 31, nombre: "Jamón crudo, rúcula y parmesano", pan: N },
      { n: 32, nombre: "Jamón crudo, rúcula y tomate", pan: N },
      // En la carta dice "(consultar)": queda cargado pero apagado, y el local
      // lo prende desde el panel los días que lo tiene.
      {
        n: 33,
        nombre: "Matambre y queso",
        pan: B,
        descripcion: "Según disponibilidad.",
        activo: false,
      },
      { n: 34, nombre: "Atún en lomos, huevo y zanahoria", pan: N },
      { n: 35, nombre: "Champiñón, parmesano y tomate", pan: N },
      { n: 36, nombre: "Jamón, queso, tomate y lechuga", pan: BN },
      { n: 37, nombre: "Naranja, rúcula y parmesano", pan: N },
      { n: 38, nombre: "Queso y berenjenas", pan: N },
    ],
  },
  {
    nombre: "Doblemente especiales",
    tagline: MIGA,
    precio: 15000,
    foto: "/img/209",
    items: [
      { n: 39, nombre: "Crudo y ananá", pan: N },
      { n: 40, nombre: "Roquefort, pera, espinaca y almendras", pan: N },
      { n: 41, nombre: "Tomates secos, rúcula y parmesano", pan: N },
      { n: 42, nombre: "Tomates secos, mix de hojas, aceitunas negras y muzzarella", pan: N },
      { n: 43, nombre: "Tomate, rúcula, palta y palmitos", pan: N },
      { n: 44, nombre: "Wok, palta y tomate", pan: N },
    ],
  },
  {
    nombre: "Destacados Primorosas",
    tagline: MIGA,
    precio: 15000,
    foto: "/img/209",
    items: [
      { n: 45, nombre: "Pollo, rúcula y parmesano", pan: N },
      { n: 46, nombre: "Pollo, rúcula y tomate", pan: N },
      { n: 47, nombre: "Pollo, zanahoria y tomate", pan: N },
      {
        n: 48,
        nombre: "Pollo Caesar",
        pan: N,
        descripcion: "Pollo, lechuga, cherry, aceitunas y salsa César.",
      },
      { n: 49, nombre: "Pollo, tomate, huevo y queso", pan: N },
      { n: 50, nombre: "Pollo y wok", pan: N },
      {
        n: 53,
        nombre: "Primorosa",
        pan: null,
        precio: 18000,
        descripcion: "Frutos rojos, queso brie, mix de hojas, semillas y vinagreta en miel.",
      },
    ],
  },
  {
    nombre: "De salmón",
    tagline: MIGA,
    precio: 18000,
    foto: "/img/210",
    items: [
      { n: 51, nombre: "Salmón, queso blanco y rúcula", pan: N },
      { n: 52, nombre: "Salmón, queso blanco, palta y cherry", pan: N },
    ],
  },
  {
    nombre: "Especiales fríos",
    tagline: "Hechos artesanalmente, con cuidado y delicadeza",
    precio: 18000,
    foto: "/img/212",
    items: [
      {
        n: null,
        nombre: "Mónaco",
        pan: null,
        descripcion: "Salsa golf, pollo, cebolla caramelizada y ananá.",
      },
      {
        n: null,
        nombre: "V.I.P.",
        pan: null,
        descripcion: "Manteca, jamón crudo, nueces, queso azul y tomates secos.",
      },
      {
        n: null,
        nombre: "Pampeano",
        pan: null,
        descripcion: "Pan alemán, salsa golf, peceto, muzzarella y tomate.",
      },
      {
        n: null,
        nombre: "Granjero",
        pan: null,
        descripcion: "Mayonesa, pechuga, muzzarella y morrón con oliva.",
      },
      {
        n: null,
        nombre: "Marino",
        pan: null,
        descripcion: "Salsa golf, pasta de atún y morrón con oliva.",
      },
      { n: null, nombre: "Capresse", pan: null, descripcion: "Muzzarella, tomate y aceitunas." },
      {
        n: null,
        nombre: "Veggie",
        pan: null,
        descripcion: "Lechuga, espinaca, rúcula, champiñón, cherry y aderezo light.",
      },
    ],
  },
];

const COMBOS = [
  {
    nombre: "12 clásicos",
    descripcion: "¡3 de cada uno!",
    foto: "/img/207",
    items: [
      [1, 3],
      [3, 3],
      [4, 3],
      [10, 3],
    ],
  },
  {
    nombre: "10 especiales",
    descripcion: "¡2 de cada uno!",
    foto: "/img/208",
    items: [
      [21, 2],
      [22, 2],
      [23, 2],
      [26, 2],
      [31, 2],
    ],
  },
  {
    nombre: "6 de lujo",
    descripcion: null,
    foto: "/img/209",
    items: [
      [40, 1],
      [45, 1],
      [48, 1],
      [51, 1],
      [52, 1],
      [53, 1],
    ],
  },
] as const;
const PRECIO_COMBO = 85000;

const nombreProducto = (i: Item) =>
  i.n === null ? i.nombre : `${String(i.n).padStart(2, "0")} · ${i.nombre}`;

async function filas<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const [r] = await db.execute(q);
  return r as unknown as T[];
}

async function main() {
  const base = (await filas<{ b: string }>(sql`SELECT DATABASE() b`))[0].b;
  if (base === "railway" && !process.argv.includes("--si")) {
    throw new Error("Esto es producción: agregá --si para confirmar.");
  }

  const [empresa] = await filas<{ id: number }>(sql`SELECT id FROM companies WHERE slug = ${SLUG}`);
  if (!empresa) throw new Error(`No existe la empresa ${SLUG}`);
  const companyId = empresa.id;
  const sucursales = await filas<{ id: number }>(
    sql`SELECT id FROM locations WHERE company_id = ${companyId}`,
  );
  const locIds = sucursales.map((l) => l.id);

  await db.transaction(async (tx) => {
    const ex = (q: ReturnType<typeof sql>) => tx.execute(q);

    // 0. Con --borrar-pedidos, también los pedidos y movimientos de prueba:
    // la empresa arranca a vender de verdad con el historial, la recaudación y
    // el stock en cero. La auditoría no se toca nunca.
    if (process.argv.includes("--borrar-pedidos")) {
      const enSucursales = sql`location_id IN (${sql.join(locIds, sql`, `)})`;
      await ex(
        sql`DELETE r FROM order_item_removals r JOIN order_items i ON i.id = r.order_item_id JOIN orders o ON o.id = i.order_id WHERE o.${enSucursales}`,
      );
      await ex(
        sql`DELETE e FROM order_item_extras e JOIN order_items i ON i.id = e.order_item_id JOIN orders o ON o.id = i.order_id WHERE o.${enSucursales}`,
      );
      await ex(
        sql`DELETE i FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.${enSucursales}`,
      );
      const [r] = await ex(sql`DELETE FROM orders WHERE ${enSucursales}`);
      await ex(sql`DELETE FROM order_sequences WHERE ${enSucursales}`);
      await ex(sql`DELETE FROM movements WHERE company_id = ${companyId}`);
      await ex(sql`DELETE FROM artistock WHERE company_id = ${companyId}`);
      console.log(
        `Borrados ${(r as unknown as { affectedRows: number }).affectedRows} pedidos con sus líneas, y los movimientos de stock y caja.`,
      );
    }

    // 1. El catálogo anterior, con todo lo que cuelga de él.
    await ex(sql`DELETE FROM location_prices WHERE location_id IN (${sql.join(locIds, sql`, `)})`);
    await ex(
      sql`DELETE FROM location_products WHERE location_id IN (${sql.join(locIds, sql`, `)})`,
    );
    await ex(
      sql`DELETE FROM location_categories WHERE location_id IN (${sql.join(locIds, sql`, `)})`,
    );
    await ex(sql`DELETE FROM location_combos WHERE location_id IN (${sql.join(locIds, sql`, `)})`);
    await ex(
      sql`DELETE cp FROM combo_products cp JOIN combos c ON c.id = cp.combo_id WHERE c.company_id = ${companyId}`,
    );
    await ex(sql`DELETE FROM combos WHERE company_id = ${companyId}`);
    await ex(
      sql`DELETE pi FROM product_ingredients pi JOIN products p ON p.id = pi.product_id WHERE p.company_id = ${companyId}`,
    );
    await ex(sql`DELETE FROM artistock WHERE company_id = ${companyId} AND product_id IS NOT NULL`);
    await ex(
      sql`DELETE FROM stock_limits WHERE company_id = ${companyId} AND product_id IS NOT NULL`,
    );
    await ex(sql`DELETE FROM products WHERE company_id = ${companyId}`);
    await ex(sql`DELETE FROM categories WHERE company_id = ${companyId}`);

    // 2. La carta nueva.
    const porNumero = new Map<number, number>();
    let ordenCat = 0;
    let total = 0;
    for (const cat of CARTA) {
      const [r] = await ex(sql`
        INSERT INTO categories
          (company_id, name, tagline, photo_url, active, sort, regalo_cada, regalo_cantidad)
        VALUES (${companyId}, ${cat.nombre}, ${cat.tagline}, ${cat.foto}, 1, ${ordenCat++},
                ${cat.tagline === MIGA ? REGALO_MIGA.cada : null},
                ${cat.tagline === MIGA ? REGALO_MIGA.cantidad : null})`);
      const categoryId = (r as unknown as { insertId: number }).insertId;

      let orden = 0;
      for (const item of cat.items) {
        const [p] = await ex(sql`
          INSERT INTO products
            (company_id, category_id, name, description, price, photo_url, active, sort,
             stockable, customizable, pan, unit, units_per_bulk)
          VALUES
            (${companyId}, ${categoryId}, ${nombreProducto(item)}, ${item.descripcion ?? null},
             ${(item.precio ?? cat.precio).toFixed(2)}, ${cat.foto}, ${item.activo === false ? 0 : 1},
             ${orden++}, 1, 0, ${item.pan}, 'u', 1)`);
        const productId = (p as unknown as { insertId: number }).insertId;
        if (item.n !== null) porNumero.set(item.n, productId);
        total++;

        // Stock inicial en cada sucursal: un ingreso en el libro y el
        // acumulado, controlado desde ahora (lo agotado deja de venderse).
        for (const locationId of locIds) {
          await ex(sql`
            INSERT INTO movements (company_id, location_id, product_id, type, action_code, amount, detail)
            VALUES (${companyId}, ${locationId}, ${productId}, 'stock', 'ING_AJUSTE',
                    ${STOCK_INICIAL.toFixed(2)}, 'Stock inicial de la carta')`);
          await ex(sql`
            INSERT INTO artistock (company_id, product_id, location_id, ip_local, control_desde)
            VALUES (${companyId}, ${productId}, ${locationId}, ${STOCK_INICIAL.toFixed(2)}, NOW())`);
        }
      }
    }

    // 3. Los combos.
    let ordenCombo = 0;
    for (const combo of COMBOS) {
      const [r] = await ex(sql`
        INSERT INTO combos (company_id, name, description, price, photo_url, active, sort)
        VALUES (${companyId}, ${combo.nombre}, ${combo.descripcion}, ${PRECIO_COMBO.toFixed(2)},
                ${combo.foto}, 1, ${ordenCombo++})`);
      const comboId = (r as unknown as { insertId: number }).insertId;
      for (const [n, cantidad] of combo.items) {
        const productId = porNumero.get(n);
        if (!productId) throw new Error(`El combo ${combo.nombre} pide el n° ${n}, que no está`);
        await ex(sql`
          INSERT INTO combo_products (combo_id, product_id, quantity)
          VALUES (${comboId}, ${productId}, ${cantidad})`);
      }
    }

    console.log(
      `${base}: ${CARTA.length} categorías, ${total} productos y ${COMBOS.length} combos cargados en PrimoRosas.`,
    );
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
