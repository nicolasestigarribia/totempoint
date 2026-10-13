/**
 * Da de alta "Demo", la empresa de prueba: un bar de cerveza artesanal con
 * todo lo suyo —empresa, dueño, sucursal, tótem, catálogo con fotos, combos,
 * portada— y los tres módulos prendidos (tótem, pedido online y mesas), para
 * probar cualquier cosa sin tocar los datos de un cliente.
 *
 * No lleva el nombre de ningún local real a propósito: es la que se muestra y
 * se rompe probando.
 *
 * Las fotos vienen de Pexels (licencia libre, uso comercial sin atribución) y
 * se guardan en `images` igual que una subida desde el panel, así que se
 * sirven por /img/:id y se pueden reemplazar sin tocar código.
 *
 * El dueño es `demo` / `demo123`. Esa contraseña no cumple la regla de
 * `password-policy.ts` (8 caracteres): se acepta solo acá, para que la demo
 * se pueda dictar. Por eso el script no corre contra producción.
 *
 * Correr con:  bun run src/db/seed-demo.ts
 * Es idempotente: si la empresa ya existe, le rehace el catálogo y la portada
 * y no toca al dueño.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
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
  onlineSettings,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { cargarMotivosBase } from "@/lib/stock/motivos-base";

const SLUG = "demo";
const NOMBRE = "Demo";
const USUARIO = "demo";
const CLAVE = "demo123";
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
  const data = Buffer.from(await res.arrayBuffer());

  const [{ id }] = await db.insert(images).values({ companyId, mimeType, data }).$returningId();
  const ruta = `/img/${id}`;
  cache.set(key, ruta);
  return ruta;
}

/** El logo: aro verde sobre negro con "DEMO". En SVG, nítido en la tablet y en el QR. */
function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <circle cx="100" cy="100" r="96" fill="#111"/>
  <circle cx="100" cy="100" r="86" fill="none" stroke="${VERDE}" stroke-width="6"/>
  <text x="100" y="118" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="52" fill="${VERDE}">DEMO</text>
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

/** La demo tiene todo: es donde se prueba cualquier canal. */
const MODULOS = { totemEnabled: true, onlineOrdering: true, mesasEnabled: true };

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
      .set({ ...MODULOS, name: NOMBRE, primaryColor: VERDE, active: true })
      .where(eq(companies.id, existente.id));
    return existente.id;
  }

  const [{ id }] = await db
    .insert(companies)
    .values({ ...MODULOS, name: NOMBRE, slug: SLUG, primaryColor: VERDE, active: true })
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
      .values({ companyId, name: NOMBRE, slug: SLUG, active: true })
      .$returningId();
    locationId = id;
    console.log("Sucursal creada.");
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
    .where(eq(users.username, USUARIO))
    .limit(1);

  if (!duenio) {
    const [{ id: userId }] = await db
      .insert(users)
      .values({
        email: "demo@totempoint.com",
        username: USUARIO,
        passwordHash: await hashPassword(CLAVE),
        companyId,
        locationId,
        active: true,
      })
      .$returningId();
    await db.insert(userRoles).values({ userId, role: "owner" });
    await db.insert(userLocations).values({ userId, locationId });
    console.log(`Dueño creado: ${USUARIO} / ${CLAVE}.`);
  } else {
    console.log("El dueño ya existía, no se toca.");
  }

  // Pedido online con retiro y efectivo: el envío necesita marcar el punto de
  // la sucursal en el mapa, y eso se hace desde el panel.
  const [online] = await db
    .select({ id: onlineSettings.id })
    .from(onlineSettings)
    .where(eq(onlineSettings.locationId, locationId))
    .limit(1);
  if (!online) {
    await db.insert(onlineSettings).values({
      companyId,
      locationId,
      enabled: true,
      pickupEnabled: true,
      deliveryEnabled: false,
      cashEnabled: true,
    });
    console.log("Pedido online prendido (retiro y efectivo).");
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
  // Un dueño con contraseña débil no puede quedar en la base real.
  const [[base]] = (await db.execute(sql`SELECT DATABASE() AS nombre`)) as unknown as [
    { nombre: string }[],
  ];
  if (base.nombre === "railway") {
    console.error("La demo no se carga en producción: su contraseña es débil a propósito.");
    process.exit(1);
  }

  const companyId = await empresa();
  await negocioYDuenio(companyId);
  await limpiarCatalogo(companyId);
  // Sin los motivos base, la sección Stock no deja cargar ni el stock inicial.
  const motivos = await cargarMotivosBase(companyId);
  if (motivos > 0) console.log(`${motivos} motivos de movimiento cargados.`);

  // Logo
  const [{ id: logoId }] = await db
    .insert(images)
    .values({
      companyId,
      mimeType: "image/svg+xml",
      data: Buffer.from(logoSvg(), "utf8"),
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
    titleAccent: "de la casa",
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

  console.log(
    `\nListo. Tótem: /t/${SLUG}/${SLUG}/1 · Online: /p/${SLUG}/${SLUG} · Panel: ${USUARIO} / ${CLAVE}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
