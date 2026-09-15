/**
 * Migración one-off: bebidas cargadas como ingredientes globales → productos de reventa.
 *
 * Detecta ingredientes GLOBALES (companyId null) en categoría "Bebidas" y, por cada
 * empresa activa, crea un producto de reventa (stockable, precio 0) llevando unidad y UxB.
 * Repunta artistock/movements/stockLimits del ingrediente global al producto de la empresa
 * (por local), y finalmente borra el ingrediente global.
 *
 * Uso:
 *   bun run src/db/migrate-resale.ts            → DRY RUN (sólo imprime el plan)
 *   bun run src/db/migrate-resale.ts --apply    → ejecuta los cambios
 */
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  ingredients,
  ingredientCategories,
  products,
  artistock,
  movements,
  stockLimits,
  productIngredients,
  companies,
  locations,
} from "./schema";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? ">> MODO APPLY (se escriben cambios)\n" : ">> DRY RUN (no se escribe nada)\n");

  // 1. Categorías globales llamadas "Bebidas".
  const bebidasCats = await db
    .select({ id: ingredientCategories.id })
    .from(ingredientCategories)
    .where(and(isNull(ingredientCategories.companyId), eq(ingredientCategories.name, "Bebidas")));

  if (bebidasCats.length === 0) {
    console.log('No hay categoría global "Bebidas". Nada para migrar.');
    process.exit(0);
  }
  const bebidasCatIds = bebidasCats.map((c) => c.id);

  // 2. Ingredientes globales de reventa (en categoría Bebidas).
  const resale = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      unit: ingredients.unit,
      unitsPerBulk: ingredients.unitsPerBulk,
    })
    .from(ingredients)
    .where(and(isNull(ingredients.companyId), inArray(ingredients.categoryId, bebidasCatIds)));

  if (resale.length === 0) {
    console.log("No hay ingredientes globales de reventa. Nada para migrar.");
    process.exit(0);
  }

  // 3. Empresas activas.
  const activeCompanies = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.active, true));

  console.log(`Ingredientes de reventa detectados: ${resale.map((r) => r.name).join(", ")}`);
  console.log(`Empresas activas: ${activeCompanies.length}\n`);

  for (const g of resale) {
    console.log(`• ${g.name} (ingrediente global #${g.id})`);

    for (const c of activeCompanies) {
      // Locales de la empresa.
      const locs = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.companyId, c.id));
      const locIds = locs.map((l) => l.id);

      // ¿Ya existe un producto con ese nombre en la empresa? (idempotencia)
      const [existingProduct] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.companyId, c.id), eq(products.name, g.name)))
        .limit(1);

      // Conteo de filas de stock a repuntar (por locales de la empresa).
      const stockRows = locIds.length
        ? await db
            .select({ id: artistock.id })
            .from(artistock)
            .where(and(eq(artistock.ingredientId, g.id), inArray(artistock.locationId, locIds)))
        : [];
      const movRows = locIds.length
        ? await db
            .select({ id: movements.id })
            .from(movements)
            .where(and(eq(movements.ingredientId, g.id), inArray(movements.locationId, locIds)))
        : [];
      const limitRows = await db
        .select({ id: stockLimits.id })
        .from(stockLimits)
        .where(and(eq(stockLimits.ingredientId, g.id), eq(stockLimits.companyId, c.id)));

      console.log(
        `   - ${c.name}: ${existingProduct ? "producto YA existe → repunta stock" : "crea producto"}` +
          ` | artistock:${stockRows.length} movements:${movRows.length} limits:${limitRows.length}`,
      );

      if (!APPLY) continue;

      let productId = existingProduct?.id;
      if (!productId) {
        const [ins] = await db
          .insert(products)
          .values({
            companyId: c.id,
            categoryId: null,
            name: g.name,
            price: "0",
            stockable: true,
            unit: g.unit,
            unitsPerBulk: g.unitsPerBulk,
            active: true,
          })
          .$returningId();
        productId = ins.id;
      }

      if (locIds.length) {
        await db
          .update(artistock)
          .set({ ingredientId: null, productId })
          .where(and(eq(artistock.ingredientId, g.id), inArray(artistock.locationId, locIds)));
        await db
          .update(movements)
          .set({ ingredientId: null, productId })
          .where(and(eq(movements.ingredientId, g.id), inArray(movements.locationId, locIds)));
      }
      await db
        .update(stockLimits)
        .set({ ingredientId: null, productId })
        .where(and(eq(stockLimits.ingredientId, g.id), eq(stockLimits.companyId, c.id)));
    }

    if (APPLY) {
      // Limpieza: relaciones de receta (no debería haber) y el ingrediente global.
      await db.delete(productIngredients).where(eq(productIngredients.ingredientId, g.id));
      await db.delete(ingredients).where(eq(ingredients.id, g.id));
      console.log(`   ✓ ingrediente global #${g.id} borrado`);
    }
  }

  console.log(APPLY ? "\nMigración aplicada." : "\nDry run terminado. Corré con --apply para ejecutar.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en la migración:", err);
  process.exit(1);
});
