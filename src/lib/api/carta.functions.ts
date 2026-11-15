import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireEdit } from "@/lib/auth/middleware";
import { assertCanEdit } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/audit/registrar";
import { claveNombre } from "@/lib/carta";

/**
 * Cargar el menú desde la carta: la lectura (foto o PDF) y el borrador se hacen
 * en el navegador del dueño, gratis (`leer-carta-navegador.ts`,
 * `interpretarCarta`, `armarBorrador`). Al servidor solo llega lo que el dueño
 * revisó y dejó tildado, y `guardarCarta` lo valida todo de nuevo.
 *
 * Crea productos y categorías, así que pide permiso de edición en las dos.
 */

const precio = z.coerce.number().positive().finite().max(100_000_000);

export const guardarCarta = createServerFn({ method: "POST" })
  .middleware([requireEdit("productos")])
  .inputValidator(
    z.object({
      categorias: z
        .array(
          z.object({
            nombre: z.string().trim().min(1).max(80),
            existenteId: z.number().int().nullable(),
            productos: z
              .array(
                z.object({
                  nombre: z.string().trim().min(1, "Hay un producto sin nombre").max(120),
                  descripcion: z.string().trim().max(500).nullable(),
                  precio: precio.nullable(),
                  // La misma regla que los tamaños de Productos: hasta 8, sin repetir.
                  tamanios: z
                    .array(z.object({ nombre: z.string().trim().min(1).max(40), precio }))
                    .max(8, "Como mucho 8 tamaños por producto")
                    .refine(
                      (ts) => new Set(ts.map((t) => claveNombre(t.nombre))).size === ts.length,
                      "Hay dos tamaños con el mismo nombre",
                    ),
                }),
              )
              .min(1)
              .max(300),
          }),
        )
        .min(1)
        .max(60),
    }),
  )
  .handler(async ({ context, data }): Promise<{ categorias: number; productos: number }> => {
    const user = context.user as SessionUser;
    const companyId = user.companyId;
    if (!companyId) throw new Error("Usuario sin empresa asignada");
    assertCanEdit(user, "categorias");

    const totalProductos = data.categorias.reduce((s, c) => s + c.productos.length, 0);
    if (totalProductos > 500) throw new Error("Son demasiados productos para cargar de una vez");
    for (const c of data.categorias) {
      for (const p of c.productos) {
        if (p.tamanios.length === 0 && p.precio == null) {
          throw new Error(`Falta el precio de ${p.nombre}`);
        }
      }
    }

    const resultado = await db.transaction(async (tx) => {
      const existentes = await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.companyId, companyId));
      const porId = new Map(existentes.map((c) => [c.id, c.id]));
      const porNombre = new Map(existentes.map((c) => [claveNombre(c.name), c.id]));
      const [{ ultimo }] = await tx
        .select({ ultimo: max(categories.sort) })
        .from(categories)
        .where(eq(categories.companyId, companyId));
      let sortCategoria = (ultimo ?? 0) + 1;
      let creadas = 0;
      let cargados = 0;

      for (const c of data.categorias) {
        // Una categoría ajena o borrada mientras se revisaba se resuelve por nombre.
        let categoryId =
          (c.existenteId != null ? porId.get(c.existenteId) : undefined) ??
          porNombre.get(claveNombre(c.nombre));
        if (categoryId == null) {
          const [{ id }] = await tx
            .insert(categories)
            .values({ companyId, name: c.nombre, sort: sortCategoria++, active: true })
            .$returningId();
          categoryId = id;
          porNombre.set(claveNombre(c.nombre), id);
          creadas++;
        }

        // Un reenvío (doble toque, respuesta perdida) no duplica: lo que ya
        // existe con ese nombre en esa categoría se saltea. El mismo nombre en
        // otra categoría sí se permite, el dueño lo tildó a propósito.
        const enCategoria = await tx
          .select({ name: products.name, sort: products.sort })
          .from(products)
          .where(and(eq(products.companyId, companyId), eq(products.categoryId, categoryId)));
        const nombres = new Set(enCategoria.map((p) => claveNombre(p.name)));
        let sortProducto = Math.max(-1, ...enCategoria.map((p) => p.sort)) + 1;
        const nuevos = c.productos.filter((p) => {
          const k = claveNombre(p.nombre);
          if (nombres.has(k)) return false;
          nombres.add(k);
          return true;
        });
        if (nuevos.length === 0) continue;

        await tx.insert(products).values(
          nuevos.map((p) => {
            const tamanios =
              p.tamanios.length > 0
                ? p.tamanios.map((t) => ({ nombre: t.nombre, precio: t.precio.toFixed(2) }))
                : null;
            return {
              companyId,
              categoryId,
              name: p.nombre,
              description: p.descripcion || null,
              price: tamanios ? tamanios[0].precio : (p.precio as number).toFixed(2),
              active: true,
              sort: sortProducto++,
              stockable: false,
              customizable: false,
              tamanios,
              unitsPerBulk: "1",
            };
          }),
        );
        cargados += nuevos.length;
      }
      return { categorias: creadas, productos: cargados };
    });

    await registrarAuditoria(user, {
      category: "precios",
      action: "carta.importar",
      summary: `Cargó ${resultado.productos} productos desde la carta (${resultado.categorias} categorías nuevas)`,
      details: { productos: resultado.productos, categorias: resultado.categorias },
    });

    return resultado;
  });
