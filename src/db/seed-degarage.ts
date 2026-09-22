/**
 * Da de alta "De Garage", un bar de cerveza artesanal, con todo lo suyo:
 * empresa, dueño, negocio, catálogo con fotos, combos y la portada del tótem.
 *
 * El menú sale de la carta real del bar (para picar, para beber, tragos), con
 * sus precios. La identidad también: verde sobre negro, que es como se ve su
 * cartelería, y el logo redibujado como SVG —un logo de stock sería el logo de
 * otro, y la imagen original es de ellos, no nuestra para redistribuir—.
 *
 * Las fotos vienen de Pexels (licencia libre, uso comercial sin atribución) y
 * se guardan en `images` igual que una subida desde el panel, así que se
 * sirven por /img/:id y el dueño puede reemplazarlas sin tocar código.
 *
 * Correr con:  bun run src/db/seed-degarage.ts
 * Es idempotente: si la empresa ya existe, le rehace el catálogo y la portada.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  companies,
  locations,
  totems,
  users,
  userRoles,
  userLocations,
  categories,
  products,
  combos,
  comboProducts,
  images,
  totemSettings,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";

const SLUG = "de-garage";
const NOMBRE = "De Garage";
const VERDE = "#3FBF4F";

// ---------- Fotos ----------
const ANCHO = 900;
const BASE = "https://images.pexels.com/photos";

const FOTOS = {
  portada: "31071253/pexels-photo-31071253.jpeg",

  catPicar: "5837000/pexels-photo-5837000.jpeg",
  catBeber: "33315800/pexels-photo-33315800.jpeg",
  catTragos: "33174185/pexels-photo-33174185.jpeg",

  tequenos: "36361401/pexels-photo-36361401.jpeg",
  chipa: "13063312/pexels-photo-13063312.jpeg",
  papas: "15754939/pexels-photo-15754939.jpeg",
  papasBicampeon: "12557546/pexels-photo-12557546.jpeg",
  nachos: "6696938/pexels-photo-6696938.jpeg",
  polloFrito: "11710530/pexels-photo-11710530.jpeg",
  empanadas: "37153389/pexels-photo-37153389.jpeg",
  salsas: "5737255/pexels-photo-5737255.jpeg",

  pinta: "5055253/pexels-photo-5055253.jpeg",
  pintaIpa: "12489338/pexels-photo-12489338.jpeg",
  botellon: "5532996/pexels-photo-5532996.jpeg",
  litro: "26791665/pexels-photo-26791665.jpeg",
  agua: "31107435/pexels-photo-31107435/free-photo-of-elegant-table-setting-with-bottled-water.jpeg",
  gaseosa: "5860659/pexels-photo-5860659.jpeg",
  jugo: "158053/fresh-orange-juice-squeezed-refreshing-citrus-158053.jpeg",

  gintonic: "15866907/pexels-photo-15866907.jpeg",
  vodka: "9002995/pexels-photo-9002995.jpeg",
  whisky: "12280754/pexels-photo-12280754.jpeg",

  comboPicada: "5837000/pexels-photo-5837000.jpeg",
  comboPrevia: "5055253/pexels-photo-5055253.jpeg",
} as const;

type FotoKey = keyof typeof FOTOS;

const cache = new Map<FotoKey, string>();
async function foto(companyId: number, key: FotoKey): Promise<string | null> {
  const guardada = cache.get(key);
  if (guardada) return guardada;

  const url = `${BASE}/${FOTOS[key]}?auto=compress&cs=tinysrgb&w=${ANCHO}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Una foto que no baja no puede frenar el alta entera: el producto queda
    // sin imagen y el dueño la sube desde el panel.
    console.warn(`  (sin foto para ${key}: Pexels respondió ${res.status})`);
    return null;
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");

  const [{ id }] = await db.insert(images).values({ companyId, mimeType, data }).$returningId();
  const ruta = `/img/${id}`;
  cache.set(key, ruta);
  return ruta;
}

/**
 * El logo, redibujado: aro verde con el monograma DG y el texto alrededor,
 * como el original del bar. Va en SVG para que se vea nítido en la tablet y
 * en el QR impreso por igual.
 */
function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <circle cx="120" cy="120" r="120" fill="#0d0f0d"/>
  <circle cx="120" cy="120" r="108" fill="none" stroke="${VERDE}" stroke-width="5"/>

  <!-- Monograma DG: dos cuadrados encastrados, como el del bar. A 64 píxeles
       esto es lo único que se llega a leer, así que se lleva el centro. -->
  <g fill="none" stroke="${VERDE}" stroke-width="11" stroke-linejoin="round">
    <rect x="62" y="74" width="66" height="68" rx="6"/>
    <rect x="112" y="74" width="66" height="68" rx="6"/>
    <path d="M 178 108 h -26"/>
  </g>

  <text x="120" y="186" text-anchor="middle" fill="${VERDE}"
        font-family="Georgia, serif" font-size="27" font-weight="bold" letter-spacing="3">DE GARAGE</text>
  <text x="120" y="207" text-anchor="middle" fill="${VERDE}" opacity="0.75"
        font-family="Georgia, serif" font-size="11" letter-spacing="1.5">CERVEZA ARTESANAL</text>
</svg>`;
}

// ---------- El catálogo ----------

interface ProductoSeed {
  name: string;
  description?: string;
  price: string;
  foto?: FotoKey;
}

interface CategoriaSeed {
  name: string;
  tagline: string;
  foto: FotoKey;
  productos: ProductoSeed[];
}

const CATALOGO: CategoriaSeed[] = [
  {
    name: "Para picar",
    tagline: "Todo va mejor con birra",
    foto: "catPicar",
    productos: [
      {
        name: "Tequeños",
        description: "Seis bastones de queso en masa crocante. Maridan con Pilsen o Blonde Ale.",
        price: "15000",
        foto: "tequenos",
      },
      {
        name: "Chipá frito",
        description: "Chipá recién frito, por fuera crocante y por dentro elástico.",
        price: "13000",
        foto: "chipa",
      },
      {
        name: "Papas fritas",
        description: "Con sazón especial de la casa. Maridan con Session IPA.",
        price: "15000",
        foto: "papas",
      },
      {
        name: "Papas bicampeón",
        description: "Salsa 4 quesos y 2 huevos arriba. Maridan con American IPA.",
        price: "16000",
        foto: "papasBicampeon",
      },
      {
        name: "Nachos",
        description:
          "Salsa cheddar ahumada, carne desmenuzada, queso ahumado rallado y honey bacon crispy.",
        price: "15000",
        foto: "nachos",
      },
      {
        name: "Pollo frito + salsa hot honey",
        description: "Crocante por fuera, jugoso adentro. Marida con American IPA.",
        price: "15000",
        foto: "polloFrito",
      },
      {
        name: "Empanadas sin TACC",
        description: "Aptas para celíacos.",
        price: "12000",
        foto: "empanadas",
      },
      {
        name: "Pizzeta sin TACC",
        description: "Apta para celíacos.",
        price: "12000",
      },
      {
        name: "Salsa extra",
        description: "Guacamole, cheddar clásico, picante (hot honey o tomate), BBQ o alioli.",
        price: "3000",
        foto: "salsas",
      },
    ],
  },
  {
    name: "Para beber",
    tagline: "Tirada del día y recargas",
    foto: "catBeber",
    productos: [
      {
        name: "Pinta clásica",
        description: "Una pinta de la tirada clásica del día.",
        price: "6000",
        foto: "pinta",
      },
      {
        name: "Pinta IPA",
        description: "Una pinta de la IPA del día.",
        price: "7000",
        foto: "pintaIpa",
      },
      {
        name: "Media pinta",
        description: "Para probar sin comprometerse.",
        price: "3500",
      },
      {
        name: "Happy hour clásica",
        description: "Precio de happy hour, en su horario.",
        price: "4000",
      },
      {
        name: "Happy hour IPA",
        description: "Precio de happy hour, en su horario.",
        price: "5000",
      },
      {
        name: "Cerveza sin TACC",
        description: "Apta para celíacos.",
        price: "7000",
      },
      {
        name: "Recarga de botellón clásicas",
        description: "Traé tu botellón y llevate 2 litros de la tirada clásica.",
        price: "14500",
        foto: "botellon",
      },
      {
        name: "Recarga de botellón con IPA",
        description: "Dos litros de IPA en tu botellón.",
        price: "18000",
      },
      {
        name: "1 litro clásica",
        description: "Un litro para llevar.",
        price: "8000",
        foto: "litro",
      },
      {
        name: "1 litro IPA",
        description: "Un litro de IPA para llevar.",
        price: "10000",
      },
      {
        name: "PET",
        description: "Envase de un litro, si no traés el tuyo.",
        price: "1000",
      },
      {
        name: "Ficha máquina de latas",
        description: "Para la máquina de latas. En efectivo sale $9.000.",
        price: "10000",
      },
      { name: "Agua mineral", price: "4500", foto: "agua" },
      { name: "Gaseosa", price: "4500", foto: "gaseosa" },
      { name: "Jugo natural", price: "5500", foto: "jugo" },
    ],
  },
  {
    name: "Tragos",
    tagline: "¡Boomba!",
    foto: "catTragos",
    productos: [
      { name: "Fernet", price: "8500" },
      { name: "Cuba libre", price: "8500" },
      { name: "Gin tonic", price: "8500", foto: "gintonic" },
      { name: "Campari", price: "8500" },
      { name: "Vodka", price: "8500", foto: "vodka" },
      { name: "Vodka con Speed", price: "11500" },
      { name: "Whiscola", price: "11000", foto: "whisky" },
      { name: "Whisky con Speed", price: "14000" },
      { name: "Jagger", price: "12500" },
      { name: "Jagger con Speed", price: "15500" },
      { name: "Vermouth", price: "7500" },
    ],
  },
];

interface ComboSeed {
  name: string;
  description: string;
  price: string;
  foto: FotoKey;
  items: { producto: string; cantidad: number }[];
}

const COMBOS: ComboSeed[] = [
  {
    name: "Picada para dos",
    description: "Papas fritas, tequeños y dos pintas clásicas.",
    price: "38000",
    foto: "comboPicada",
    items: [
      { producto: "Papas fritas", cantidad: 1 },
      { producto: "Tequeños", cantidad: 1 },
      { producto: "Pinta clásica", cantidad: 2 },
    ],
  },
  {
    name: "La previa",
    description: "Nachos para compartir y dos IPA tiradas.",
    price: "27000",
    foto: "comboPrevia",
    items: [
      { producto: "Nachos", cantidad: 1 },
      { producto: "Pinta IPA", cantidad: 2 },
    ],
  },
  {
    name: "Botellón cargado",
    description: "Recarga de botellón clásica con una porción de papas.",
    price: "27000",
    foto: "botellon",
    items: [
      { producto: "Recarga de botellón clásicas", cantidad: 1 },
      { producto: "Papas fritas", cantidad: 1 },
    ],
  },
];

// ---------- Alta ----------

async function empresa(): Promise<number> {
  const [existente] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, SLUG))
    .limit(1);

  if (existente) {
    console.log(`La empresa ya existía (id ${existente.id}): se le rehace el catálogo.`);
    await db
      .update(companies)
      .set({ name: NOMBRE, primaryColor: VERDE, active: true })
      .where(eq(companies.id, existente.id));
    return existente.id;
  }

  const [{ id }] = await db
    .insert(companies)
    .values({ name: NOMBRE, slug: SLUG, primaryColor: VERDE, active: true })
    .$returningId();
  console.log(`Empresa creada (id ${id}).`);
  return id;
}

async function negocioYDuenio(companyId: number) {
  const [local] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.companyId, companyId))
    .limit(1);

  let locationId = local?.id;
  if (!locationId) {
    const [{ id }] = await db
      .insert(locations)
      .values({ companyId, name: "De Garage", slug: "de-garage", active: true })
      .$returningId();
    locationId = id;
    console.log("Negocio creado.");
  }

  // Sin una fila en `totems` la URL no resuelve y el demo queda inservible:
  // el tótem se identifica por local y número, no por empresa.
  const [totem] = await db
    .select({ id: totems.id })
    .from(totems)
    .where(and(eq(totems.locationId, locationId), eq(totems.number, 1)))
    .limit(1);
  if (!totem) {
    await db.insert(totems).values({ locationId, number: 1, label: "Mostrador", active: true });
    console.log("Tótem 1 creado.");
  }

  const [duenio] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "degarage"))
    .limit(1);

  if (!duenio) {
    const [{ id: userId }] = await db
      .insert(users)
      .values({
        email: "degarage@totempoint.com",
        username: "degarage",
        passwordHash: await hashPassword("DeGarage2026"),
        companyId,
        locationId,
        active: true,
      })
      .$returningId();
    await db.insert(userRoles).values({ userId, role: "owner" });
    await db.insert(userLocations).values({ userId, locationId });
    console.log("Dueño creado: degarage / DeGarage2026 (cambiala desde Mi cuenta).");
  } else {
    console.log("El dueño ya existía, no se toca.");
  }

  return locationId;
}

async function limpiarCatalogo(companyId: number) {
  const viejos = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.companyId, companyId));
  const viejosCombos = await db
    .select({ id: combos.id })
    .from(combos)
    .where(eq(combos.companyId, companyId));

  if (viejosCombos.length > 0) {
    await db.delete(comboProducts).where(
      inArray(
        comboProducts.comboId,
        viejosCombos.map((c) => c.id),
      ),
    );
    await db.delete(combos).where(eq(combos.companyId, companyId));
  }
  if (viejos.length > 0) {
    await db.delete(products).where(eq(products.companyId, companyId));
  }
  await db.delete(categories).where(eq(categories.companyId, companyId));
}

async function main() {
  const companyId = await empresa();
  await negocioYDuenio(companyId);
  await limpiarCatalogo(companyId);

  // Logo
  const [{ id: logoId }] = await db
    .insert(images)
    .values({
      companyId,
      mimeType: "image/svg+xml",
      data: Buffer.from(logoSvg(), "utf8").toString("base64"),
    })
    .$returningId();
  await db
    .update(companies)
    .set({ logoUrl: `/img/${logoId}` })
    .where(eq(companies.id, companyId));
  console.log("Logo cargado.");

  // Catálogo
  const idPorNombre = new Map<string, number>();
  for (const [i, cat] of CATALOGO.entries()) {
    const photoUrl = await foto(companyId, cat.foto);
    const [{ id: categoryId }] = await db
      .insert(categories)
      .values({
        companyId,
        name: cat.name,
        tagline: cat.tagline,
        photoUrl,
        sort: i,
        active: true,
      })
      .$returningId();

    for (const p of cat.productos) {
      const fotoProducto = p.foto ? await foto(companyId, p.foto) : null;
      const [{ id: productId }] = await db
        .insert(products)
        .values({
          companyId,
          categoryId,
          name: p.name,
          description: p.description ?? null,
          price: p.price,
          photoUrl: fotoProducto,
          active: true,
        })
        .$returningId();
      idPorNombre.set(p.name, productId);
    }
    console.log(`Categoría "${cat.name}": ${cat.productos.length} productos.`);
  }

  // Combos
  for (const c of COMBOS) {
    const photoUrl = await foto(companyId, c.foto);
    const [{ id: comboId }] = await db
      .insert(combos)
      .values({
        companyId,
        name: c.name,
        description: c.description,
        price: c.price,
        photoUrl,
        active: true,
      })
      .$returningId();

    for (const item of c.items) {
      const productId = idPorNombre.get(item.producto);
      if (!productId)
        throw new Error(`El combo "${c.name}" apunta a "${item.producto}", que no existe`);
      await db.insert(comboProducts).values({ comboId, productId, quantity: item.cantidad });
    }
  }
  console.log(`${COMBOS.length} combos armados.`);

  // Portada del tótem
  const portada = await foto(companyId, "portada");
  const ajustes = {
    companyId,
    template: "completo" as const,
    theme: "oscuro" as const,
    fontTheme: "moderno" as const,
    corners: "suave" as const,
    heroImageUrl: portada,
    eyebrow: "Bar y recarga de cerveza artesanal",
    title: "Birra",
    titleAccent: "de garage",
    subtitle:
      "Tirada del día, recargas de botellón y algo para picar. Pedí acá y retirá en la barra.",
    ctaLabel: "Arrancar",
    badge1: "Happy hour",
    badge2: "Sin TACC",
    accentColor: VERDE,
  };

  const [settings] = await db
    .select({ id: totemSettings.id })
    .from(totemSettings)
    .where(eq(totemSettings.companyId, companyId))
    .limit(1);

  if (settings) {
    await db.update(totemSettings).set(ajustes).where(eq(totemSettings.id, settings.id));
  } else {
    await db.insert(totemSettings).values(ajustes);
  }
  console.log("Portada configurada.");

  console.log(`\nListo. El tótem queda en /t/${SLUG}/de-garage/1`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
