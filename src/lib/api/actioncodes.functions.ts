import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { actionCodes, movements } from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface ActionCodeRow {
  id: number;
  code: string;
  label: string;
  type: "stock" | "caja";
  direction: "ingreso" | "egreso";
  auto: boolean;
  active: boolean;
}

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const listActionCodesAll = createServerFn({ method: "GET" })
  .middleware([requireView("codigos")])
  .handler(async ({ context }): Promise<ActionCodeRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select()
      .from(actionCodes)
      .where(eq(actionCodes.companyId, user.companyId))
      .orderBy(asc(actionCodes.type), asc(actionCodes.code));

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      type: r.type,
      direction: r.direction,
      auto: r.auto,
      active: r.active,
    }));
  });

export const createActionCode = createServerFn({ method: "POST" })
  .middleware([requireEdit("codigos")])
  .inputValidator(
    z.object({
      code: z.string().trim().min(1).max(40),
      label: z.string().trim().min(1).max(120),
      type: z.enum(["stock", "caja"]),
      direction: z.enum(["ingreso", "egreso"]),
    }),
  )
  .handler(async ({ context, data }): Promise<ActionCodeRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const code = normalizeCode(data.code);
    if (!code) throw new Error("Código inválido");

    const [dup] = await db
      .select({ id: actionCodes.id })
      .from(actionCodes)
      .where(and(eq(actionCodes.code, code), eq(actionCodes.companyId, user.companyId)))
      .limit(1);
    if (dup) throw new Error("Ya existe un código con ese nombre");

    const [{ id }] = await db
      .insert(actionCodes)
      .values({
        companyId: user.companyId,
        code,
        label: data.label.trim(),
        type: data.type,
        direction: data.direction,
        auto: false,
        active: true,
      })
      .$returningId();

    return {
      id,
      code,
      label: data.label.trim(),
      type: data.type,
      direction: data.direction,
      auto: false,
      active: true,
    };
  });

export const updateActionCode = createServerFn({ method: "POST" })
  .middleware([requireEdit("codigos")])
  .inputValidator(
    z.object({
      id: z.number().int(),
      label: z.string().trim().min(1).max(120),
      type: z.enum(["stock", "caja"]),
      direction: z.enum(["ingreso", "egreso"]),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: actionCodes.id })
      .from(actionCodes)
      .where(and(eq(actionCodes.id, data.id), eq(actionCodes.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("No podés modificar códigos globales");

    await db
      .update(actionCodes)
      .set({
        label: data.label.trim(),
        type: data.type,
        direction: data.direction,
        active: data.active,
      })
      .where(and(eq(actionCodes.id, data.id), eq(actionCodes.companyId, user.companyId)));

    return { ok: true };
  });

export const setActionCodeActive = createServerFn({ method: "POST" })
  .middleware([requireEdit("codigos")])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await db
      .update(actionCodes)
      .set({ active: data.active })
      .where(and(eq(actionCodes.id, data.id), eq(actionCodes.companyId, user.companyId)));
    return { ok: true };
  });

export const deleteActionCode = createServerFn({ method: "POST" })
  .middleware([requireEdit("codigos")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: actionCodes.id, code: actionCodes.code })
      .from(actionCodes)
      .where(and(eq(actionCodes.id, data.id), eq(actionCodes.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("No podés borrar códigos globales");

    // Bloquea si ya tiene movimientos asociados en la empresa.
    const [used] = await db
      .select({ id: movements.id })
      .from(movements)
      .where(and(eq(movements.companyId, user.companyId), eq(movements.actionCode, existing.code)))
      .limit(1);
    if (used) {
      throw new Error(
        "No se puede borrar: el código ya tiene movimientos. Desactivalo en su lugar.",
      );
    }

    await db
      .delete(actionCodes)
      .where(and(eq(actionCodes.id, data.id), eq(actionCodes.companyId, user.companyId)));

    return { ok: true };
  });
