import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { movements, ingredients, locations, artistock, actionCodes } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import type { ActionCode } from "@/lib/actionCodes";

async function assertLocationOwned(locationId: number, companyId: number) {
  const [loc] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)))
    .limit(1);
  if (!loc) throw new Error("El local no pertenece a tu empresa");
}

async function assertIngredientUsable(ingredientId: number, companyId: number) {
  const [ing] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.id, ingredientId),
        or(isNull(ingredients.companyId), eq(ingredients.companyId, companyId)),
      ),
    )
    .limit(1);
  if (!ing) throw new Error("El ingrediente no es válido para tu empresa");
}

export interface MovementListRow {
  id: number;
  createdAt: string;
  locationId: number;
  locationName: string | null;
  type: "stock" | "caja";
  ingredientId: number | null;
  ingredientName: string | null;
  actionCode: string;
  amount: string;
  detail: string | null;
}

// Códigos de acción disponibles (globales + de la empresa), activos.
export const listActionCodes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ActionCode[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        code: actionCodes.code,
        label: actionCodes.label,
        type: actionCodes.type,
        direction: actionCodes.direction,
        auto: actionCodes.auto,
      })
      .from(actionCodes)
      .where(
        and(
          eq(actionCodes.active, true),
          or(isNull(actionCodes.companyId), eq(actionCodes.companyId, user.companyId)),
        ),
      );

    return rows.map((r) => ({
      code: r.code,
      label: r.label,
      type: r.type,
      direction: r.direction,
      auto: r.auto,
    }));
  });

// Carga manual de un movimiento (stock o caja). El código de acción define tipo y signo.
export const createMovement = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      actionCode: z.string().trim().min(1).max(40),
      ingredientId: z.number().int().nullable().optional(),
      quantity: z.number().positive(),
      detail: z.string().trim().max(255).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [def] = await db
      .select({
        type: actionCodes.type,
        direction: actionCodes.direction,
        auto: actionCodes.auto,
      })
      .from(actionCodes)
      .where(
        and(
          eq(actionCodes.code, data.actionCode),
          eq(actionCodes.active, true),
          or(isNull(actionCodes.companyId), eq(actionCodes.companyId, user.companyId)),
        ),
      )
      .limit(1);
    if (!def) throw new Error("Código de acción inválido");
    if (def.auto) throw new Error("Ese código lo genera el sistema, no se carga a mano");

    await assertLocationOwned(data.locationId, user.companyId);

    let ingredientId: number | null = null;
    if (def.type === "stock") {
      if (!data.ingredientId) throw new Error("Falta el ingrediente");
      await assertIngredientUsable(data.ingredientId, user.companyId);
      ingredientId = data.ingredientId;
    }

    const isIngreso = def.direction === "ingreso";
    const signo = isIngreso ? 1 : -1;
    const qty = String(data.quantity);
    const amountSigned = String(data.quantity * signo);

    await db.insert(movements).values({
      companyId: user.companyId,
      locationId: data.locationId,
      ingredientId,
      type: def.type,
      actionCode: data.actionCode,
      amount: amountSigned,
      detail: data.detail?.trim() || null,
    });

    // Solo stock actualiza el acumulador artistock.
    if (def.type === "stock" && ingredientId !== null) {
      await db
        .insert(artistock)
        .values({
          companyId: user.companyId,
          ingredientId,
          locationId: data.locationId,
          ipLocal: isIngreso ? qty : "0",
          epLocal: isIngreso ? "0" : qty,
        })
        .onDuplicateKeyUpdate({
          set: isIngreso
            ? { ipLocal: sql`${artistock.ipLocal} + ${qty}` }
            : { epLocal: sql`${artistock.epLocal} + ${qty}` },
        });
    }

    return { ok: true };
  });

export const listMovements = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      locationId: z.number().int().nullable().optional(),
      type: z.enum(["stock", "caja"]).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<MovementListRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const conds = [eq(movements.companyId, user.companyId)];
    if (data.locationId != null) conds.push(eq(movements.locationId, data.locationId));
    if (data.type != null) conds.push(eq(movements.type, data.type));

    const rows = await db
      .select({
        id: movements.id,
        createdAt: movements.createdAt,
        locationId: movements.locationId,
        locationName: locations.name,
        type: movements.type,
        ingredientId: movements.ingredientId,
        ingredientName: ingredients.name,
        actionCode: movements.actionCode,
        amount: movements.amount,
        detail: movements.detail,
      })
      .from(movements)
      .leftJoin(locations, eq(movements.locationId, locations.id))
      .leftJoin(ingredients, eq(movements.ingredientId, ingredients.id))
      .where(and(...conds))
      .orderBy(desc(movements.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      locationId: r.locationId,
      locationName: r.locationName,
      type: r.type,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredientName,
      actionCode: r.actionCode,
      amount: r.amount,
      detail: r.detail,
    }));
  });
