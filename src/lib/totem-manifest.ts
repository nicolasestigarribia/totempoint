/**
 * El manifiesto que convierte al tótem en una aplicación de la tablet.
 *
 * Sin esto, "Agregar a la pantalla principal" en Android deja un acceso
 * directo que abre Chrome con su barra de direcciones arriba: el cliente ve la
 * URL, puede escribir otra y el tótem deja de ser un tótem. Con el manifiesto
 * Chrome instala la web como aplicación y la abre en `fullscreen`, sin barra
 * de direcciones ni de estado.
 *
 * Es uno por tótem, no uno solo de la plataforma, porque cada negocio pone
 * su tablet: el nombre que aparece debajo del ícono es el suyo, los colores
 * son los suyos y el `scope` es su propio tótem (`/t/empresa/local/totem`),
 * así que una navegación que se fuera de ahí saldría de la aplicación en lugar
 * de quedar adentro.
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

interface Identidad {
  name: string;
  fondo: string;
  marca: string;
}

/**
 * Datos mínimos del negocio para el ícono y el manifiesto.
 *
 * Valida que la empresa, el local y el tótem existan y estén activos: el
 * manifiesto y el ícono son públicos, así que un tótem dado de baja no debe
 * seguir instalándose. La identidad visible (nombre, colores) es de la
 * empresa; el `scope` que sale de acá es el de ese tótem concreto.
 */
async function identidad(empresa: string, local: string, totem: number): Promise<Identidad | null> {
  const [row] = await db
    .select({
      name: companies.name,
      companyActive: companies.active,
      primaryColor: companies.primaryColor,
      localActive: locations.active,
      totemActive: totems.active,
      accentColor: totemSettings.accentColor,
      theme: totemSettings.theme,
    })
    .from(companies)
    .innerJoin(locations, and(eq(locations.companyId, companies.id), eq(locations.slug, local)))
    .innerJoin(totems, and(eq(totems.locationId, locations.id), eq(totems.number, totem)))
    .leftJoin(totemSettings, eq(totemSettings.companyId, companies.id))
    .where(eq(companies.slug, empresa))
    .limit(1);

  if (!row || !row.companyActive || !row.localActive || !row.totemActive) return null;

  return {
    name: row.name,
    fondo: FONDOS_HEX[(row.theme as TotemTheme) ?? "oscuro"] ?? FONDOS_HEX.oscuro,
    marca: row.accentColor || row.primaryColor || "#ffffff",
  };
}

/** El manifiesto de un tótem. 404 si empresa/local/tótem no existen o están dados de baja. */
export async function serveTotemManifest(
  empresa: string,
  local: string,
  totem: number,
): Promise<Response> {
  const negocio = await identidad(empresa, local, totem);
  if (!negocio) return new Response("Not found", { status: 404 });

  const base = `/t/${empresa}/${local}/${totem}`;
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
  empresa: string,
  local: string,
  totem: number,
  size: number,
  maskable = false,
): Promise<Response> {
  const negocio = await identidad(empresa, local, totem);
  if (!negocio) return new Response("Not found", { status: 404 });

  const png = iconoTotemPng(size, negocio.fondo, negocio.marca, maskable ? 0.72 : 1);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
