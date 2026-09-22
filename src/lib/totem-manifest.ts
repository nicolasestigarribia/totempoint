/**
 * El manifiesto que convierte al tótem en una aplicación de la tablet.
 *
 * Sin esto, "Agregar a la pantalla principal" en Android deja un acceso
 * directo que abre Chrome con su barra de direcciones arriba: el cliente ve la
 * URL, puede escribir otra y el tótem deja de ser un tótem. Con el manifiesto
 * Chrome instala la web como aplicación y la abre en `fullscreen`, sin barra
 * de direcciones ni de estado.
 *
 * Es uno por tótem, no uno solo de la plataforma, porque cada negocio pone su
 * tablet: el nombre que aparece debajo del ícono es el suyo, los colores son
 * los suyos y el `scope` es ese tótem en particular, así que una navegación
 * que se fuera de `/t/empresa/local/1` saldría de la aplicación en lugar de
 * quedar adentro. Con varios tótems en un mismo local, cada tablet instala el
 * suyo y su ícono vuelve siempre al mismo puesto.
 *
 * `start_url` lleva `?totem=1` a propósito: al abrirse desde el ícono, la
 * tablet queda marcada como tótem y se cierra cualquier sesión de panel que
 * haya quedado abierta ahí (ver `use-totem-device.ts`).
 *
 * Se sirve desde `src/server.ts`, antes del router, igual que las imágenes:
 * no es una pantalla de la aplicación sino un archivo que pide el navegador.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, locations, totems, totemSettings } from "@/db/schema";
import { iconoTotemPng } from "@/lib/totem-icon";
import { FONDOS_HEX, type TotemTheme } from "@/components/totem/useTotemTheme";

/** Los tres datos de la URL que identifican al tótem. */
export interface UbicacionTotem {
  empresa: string;
  local: string;
  totem: number;
}

interface Identidad {
  name: string;
  base: string;
  fondo: string;
  marca: string;
}

/**
 * Datos mínimos del negocio para el ícono y el manifiesto.
 *
 * Resuelve las tres partes de la URL —y no solo la empresa— porque el archivo
 * se sirve antes del router: si acá alcanzara con el slug de la empresa, un
 * local o un número inventados devolverían un manifiesto igual y la tablet
 * instalaría un tótem que no existe.
 */
async function identidad(u: UbicacionTotem): Promise<Identidad | null> {
  const [row] = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      active: companies.active,
      primaryColor: companies.primaryColor,
      accentColor: totemSettings.accentColor,
      theme: totemSettings.theme,
    })
    .from(companies)
    .leftJoin(totemSettings, eq(totemSettings.companyId, companies.id))
    .where(eq(companies.slug, u.empresa))
    .limit(1);

  if (!row || !row.active) return null;

  const [local] = await db
    .select({ id: locations.id, active: locations.active })
    .from(locations)
    .where(and(eq(locations.companyId, row.id), eq(locations.slug, u.local)))
    .limit(1);
  if (!local?.active) return null;

  const [totem] = await db
    .select({ active: totems.active })
    .from(totems)
    .where(and(eq(totems.locationId, local.id), eq(totems.number, u.totem)))
    .limit(1);
  if (!totem?.active) return null;

  return {
    name: row.name,
    base: `/t/${row.slug}/${u.local}/${u.totem}`,
    fondo: FONDOS_HEX[(row.theme as TotemTheme) ?? "oscuro"] ?? FONDOS_HEX.oscuro,
    marca: row.accentColor || row.primaryColor || "#ffffff",
  };
}

/** El manifiesto de un tótem. 404 si no existe o está dado de baja. */
export async function serveTotemManifest(u: UbicacionTotem): Promise<Response> {
  const negocio = await identidad(u);
  if (!negocio) return new Response("Not found", { status: 404 });

  const base = negocio.base;
  const manifiesto = {
    name: negocio.name,
    // Debajo del ícono entran pocos caracteres; el sistema corta igual, pero
    // cortar acá evita que quede a mitad de una palabra.
    short_name: negocio.name.slice(0, 12),
    description: `Autoservicio de ${negocio.name}`,
    start_url: `${base}?totem=1`,
    scope: base,
    // `fullscreen` esconde también la barra de estado de Android; si el
    // sistema no la puede dar, cae en `standalone`, que ya saca la barra de
    // direcciones, que es lo que importa.
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: negocio.fondo,
    theme_color: negocio.fondo,
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${base}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifiesto), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Corto: si el dueño cambia el color o el nombre, la tablet lo toma en
      // el próximo arranque y no dentro de un año.
      "cache-control": "public, max-age=3600",
    },
  });
}

/**
 * El ícono del tótem, dibujado con los colores del negocio.
 *
 * El "maskable" es el mismo dibujo más chico: Android recorta ese ícono a la
 * forma que use el lanzador —círculo, cuadrado redondeado— y solo respeta el
 * 80% del centro, así que el tótem entra al 72% para no quedarse sin pie.
 */
export async function serveTotemIcon(
  u: UbicacionTotem,
  size: number,
  maskable = false,
): Promise<Response> {
  const negocio = await identidad(u);
  if (!negocio) return new Response("Not found", { status: 404 });

  const png = iconoTotemPng(size, negocio.fondo, negocio.marca, maskable ? 0.72 : 1);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
