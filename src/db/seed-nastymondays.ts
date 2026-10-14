/**
 * Da de alta "NastyMondays" (café de especialidad, Mar del Plata) para
 * mostrárselo como posible cliente: su menú real (el PDF "MENÚ NASTYMONDAYS
 * 03.10 - DIGITAL"), con sus precios, sus colores —rojo ladrillo sobre crema—
 * y su tipografía condensada, en los tres canales: tótem, pedido online y
 * pedido en mesa con un salón armado.
 *
 * Las fotos de los productos son de Pexels (licencia libre, uso comercial sin
 * atribución), elegidas por parecido: no son las del local. Se guardan en
 * `images` como una subida desde el panel, así que se reemplazan por las
 * reales desde el panel sin tocar código. El logo es la foto de perfil de su
 * Instagram, chica (100 px): hay que pedirles el archivo.
 *
 * El dueño es `nastymondays`. En la base de pruebas su contraseña es
 * `nasty123`. En producción hay que pasarla explícita en NASTY_CLAVE y debe
 * cumplir la regla de `password-policy.ts`, o no corre; y no se imprime.
 *
 * Correr con:  bun run src/db/seed-nastymondays.ts
 * En producción:
 *   NASTY_CLAVE=... bun --env-file=.env.produccion.local run src/db/seed-nastymondays.ts
 * Es idempotente: si la empresa ya existe, le rehace el catálogo, la portada y
 * el salón, y no toca al dueño.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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
  diningTables,
  diningRooms,
  mesaSettings,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { checkPassword } from "@/lib/auth/password-policy";
import { cargarMotivosBase } from "@/lib/stock/motivos-base";
import { formatoDeImagen } from "@/lib/image-format";

const SLUG = "nastymondays";
const NOMBRE = "NastyMondays";
const SUCURSAL = "NastyMondays Mar del Plata";
const SLUG_SUCURSAL = "mar-del-plata";
const USUARIO = "nastymondays";
const CLAVE = process.env.NASTY_CLAVE || "nasty123";
/** El rojo ladrillo del menú. */
const ROJO = "#AE2124";

// ---------- Fotos ----------
const ANCHO = 900;
const BASE = "https://images.pexels.com/photos";

/**
 * Id de la foto en Pexels, o la ruta entera cuando el archivo no se llama
 * "pexels-photo-<id>.jpeg" (las fotos más viejas).
 */
const FOTOS = {
  portada: 34232215,

  catEspeciales: 6607325,
  catCombos: 20204699,
  catEspecialidades: 9443534,
  catSalado: 15110224,
  catDulce: 30550061,
  catCafeSolo: 9050518,
  catCafeLeche: 30119453,
  catCafeFrio: 28901490,
  catBebidas: 6541793,

  tortaVasca: 6607325,
  laminado: 19498991,

  rollCanela: 4610166,
  rollPistacho: 3951306,
  donaCreme: 1191639,
  donaOreo: 2955820,
  donaDdl: 9157323,
  donaPistacho: 9619310,
  prensadito: 14941252,
  cookieCuchareable: 5436475,

  tostadoArabe: 17780276,
  tostadoMolde: 15110224,
  toston: 19559056,
  avocadoToast: 14587654,
  croissantRelleno: 17582424,
  scone: 7686487,
  bagel: "6492/food-breakfast-fork-bagel.jpg",
  baconEgg: 6529599,

  tostadasMermelada: 4397307,
  tortas: 5386665,
  cookies: 301972,
  lingotes: 1126359,
  bananaToast: 6659698,
  granola: 11394986,

  espresso: 30910187,
  doppio: 26626461,
  americano: 1233528,

  cortado: 10633964,
  macchiato: 9249368,
  latte: 12620633,
  latteSaborizado: 12703064,
  flatWhite: 544113,
  capuccino: 8983399,
  mocaccino: 849646,

  coldBrew: 8605616,
  icedAmericano: 5741238,
  icedFlatWhite: 10738363,
  icedLatte: 9035556,
  icedSaborizado: 5305639,

  limonada: 6541793,
  exprimido: "158053/fresh-orange-juice-squeezed-refreshing-citrus-158053.jpeg",
  licuado: 775032,
  licuado2: 2424034,
  chocolatada: 3309658,
  te: 6634296,
  submarino: 3309748,

  comboTropical: 6659687,
  comboTradicional: 10553647,
  comboProteico: 17780276,
  comboPreferido: 30550061,
  comboSaludable: 19559056,
} as const;

type FotoKey = keyof typeof FOTOS;

/**
 * El logo: un archivo local, porque los links de Instagram vencen. Mientras no
 * manden el suyo, sirve la foto de perfil de @nastymondayscafe.
 *   NASTY_LOGO=ruta/al/logo.jpg bun run src/db/seed-nastymondays.ts
 */
const LOGO = process.env.NASTY_LOGO ?? "";

const cache = new Map<FotoKey, string>();
async function foto(companyId: number, key: FotoKey): Promise<string | null> {
  const guardada = cache.get(key);
  if (guardada) return guardada;

  const id = FOTOS[key];
  const ruta = typeof id === "string" ? id : `${id}/pexels-photo-${id}.jpeg`;
  const url = `${BASE}/${ruta}?auto=compress&cs=tinysrgb&w=${ANCHO}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Una foto que no baja no puede frenar el alta entera: el producto queda
    // sin imagen y el dueño la sube desde el panel.
    console.warn(`  (sin foto para ${key}: Pexels respondió ${res.status})`);
    return null;
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer());

  const [{ id: imgId }] = await db
    .insert(images)
    .values({ companyId, mimeType, data })
    .$returningId();
  const enlace = `/img/${imgId}`;
  cache.set(key, enlace);
  return enlace;
}

// ---------- El catálogo, tal cual el menú ----------

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

const RELLENOS = "Jamón natural y queso, o lomito y cheddar.";

const CATALOGO: CategoriaSeed[] = [
  {
    name: "Especiales del mes",
    tagline: "Solo por este mes",
    foto: "catEspeciales",
    productos: [
      {
        name: "Torta Kira",
        description:
          "Nuestra versión de la torta vasca: pastel de queso cremoso, con la superficie dorada casi tostada y el interior suave.",
        price: "9200",
        foto: "tortaVasca",
      },
      {
        name: "Flanesa",
        description: "Laminado con centro de crema pastelera, dulce de leche y flan casero.",
        price: "8500",
        foto: "laminado",
      },
    ],
  },
  {
    name: "Especialidades de la casa",
    tagline: "Disponibilidad limitada · Frescos del día",
    foto: "catEspecialidades",
    productos: [
      { name: "Roll de canela", price: "11500", foto: "rollCanela" },
      {
        name: "Roll de pistacho",
        description: "Roll de canela con salsa de pistacho y pistachos triturados.",
        price: "15000",
        foto: "rollPistacho",
      },
      {
        name: "Dona creme brulee",
        description: "Rellena de crema de vainilla, coronada con una capa de caramelo.",
        price: "8000",
        foto: "donaCreme",
      },
      {
        name: "Dona Oreo",
        description: "Rellena de crema de Oreo, coronada con glaseado y Oreo triturada.",
        price: "8000",
        foto: "donaOreo",
      },
      {
        name: "Dona dulce de leche",
        description: "Rellena de postre de dulce de leche, coronada con azúcar impalpable.",
        price: "8000",
        foto: "donaDdl",
      },
      {
        name: "Dona de pistacho",
        description:
          "Rellena de pistacho, bañada en salsa de pistacho y pistachos triturados arriba.",
        price: "9000",
        foto: "donaPistacho",
      },
      {
        name: "Prensadito de queso",
        description:
          "Pan, queso y pan. El tostado que todos amamos de chicos, ahora con nuestra receta.",
        price: "6000",
        foto: "prensadito",
      },
      {
        name: "Cookie cuchareable",
        description: "Cookie clásica de vainilla con relleno de Nutella y topping de chocolate.",
        price: "15600",
        foto: "cookieCuchareable",
      },
    ],
  },
  {
    name: "Salado",
    tagline: "Tostados, toasts y rellenos",
    foto: "catSalado",
    productos: [
      {
        name: "Tostado pan árabe",
        description: `${RELLENOS} Con huevos revueltos, +$1.200.`,
        price: "13300",
        foto: "tostadoArabe",
      },
      {
        name: "Tostado pan de molde",
        description: `${RELLENOS} Con huevos revueltos, +$1.200.`,
        price: "13300",
        foto: "tostadoMolde",
      },
      { name: "Tostado de chipá", description: RELLENOS, price: "14500" },
      {
        name: "Tostón huevos revueltos",
        description: "En pan integral con queso crema.",
        price: "10000",
        foto: "toston",
      },
      {
        name: "Avocado toast",
        description: "Tostón de pan integral con palta, huevos revueltos y queso crema.",
        price: "12000",
        foto: "avocadoToast",
      },
      { name: "Medialuna rellena", description: RELLENOS, price: "5200", foto: "croissantRelleno" },
      {
        name: "Croissant relleno",
        description: `${RELLENOS} Con huevos revueltos, +$1.400.`,
        price: "10000",
        foto: "croissantRelleno",
      },
      { name: "Scone relleno", price: "10300", foto: "scone" },
      { name: "Scone sin relleno", price: "6800", foto: "scone" },
      {
        name: "Bagel",
        description: `${RELLENOS} Con huevos revueltos, +$1.200.`,
        price: "12600",
        foto: "bagel",
      },
      {
        name: "Bacon egg & cheese sandwich",
        description: "Sándwich de panceta, huevo y cheddar.",
        price: "15000",
        foto: "baconEgg",
      },
    ],
  },
  {
    name: "Dulce",
    tagline: "Para acompañar el café",
    foto: "catDulce",
    productos: [
      { name: "Medialuna", price: "2000", foto: "catDulce" },
      { name: "Vigilante con pastelera", price: "2000", foto: "laminado" },
      {
        name: "Tostadas con mermelada y queso",
        description: "Pan blanco o integral.",
        price: "7500",
        foto: "tostadasMermelada",
      },
      {
        name: "Media porción de tostadas",
        description: "Con mermelada y queso, pan blanco o integral.",
        price: "5500",
        foto: "tostadasMermelada",
      },
      {
        name: "Laminados artesanales",
        description: "Enrejado de manzana, moño de frambuesa, sfogliatella o croissant.",
        price: "8000",
        foto: "laminado",
      },
      {
        name: "Tortas (porción individual)",
        description: "Brownie, carrot cake, crumble de manzana o limón y amapola.",
        price: "8000",
        foto: "tortas",
      },
      {
        name: "Cookies",
        description: "Kinder Bueno, Oreo o Nutella.",
        price: "7600",
        foto: "cookies",
      },
      {
        name: "Lingotes",
        description: "Chocotorta, cheesecake, ricota u Oreo.",
        price: "12000",
        foto: "lingotes",
      },
      {
        name: "Banana toast",
        description: "Tostada de pan integral con mantequilla de maní, banana y miel.",
        price: "9000",
        foto: "bananaToast",
      },
      {
        name: "Bowl de granola con yogurt y frutas",
        price: "11500",
        foto: "granola",
      },
      { name: "Productos sin TACC", description: "Consultá la variedad del día.", price: "7500" },
    ],
  },
  {
    name: "Café solo",
    tagline: "Espresso de especialidad",
    foto: "catCafeSolo",
    productos: [
      { name: "Espresso / lungo", price: "4200", foto: "espresso" },
      { name: "Doppio / lungo", price: "4700", foto: "doppio" },
      { name: "Americano", price: "4200", foto: "americano" },
      { name: "Americano doble", price: "4700", foto: "americano" },
    ],
  },
  {
    name: "Café con leche",
    tagline: "Leche de almendras, +$1.600",
    foto: "catCafeLeche",
    productos: [
      { name: "Macchiato", price: "4500", foto: "macchiato" },
      { name: "Cortado", price: "5200", foto: "cortado" },
      { name: "Magic", price: "5400", foto: "flatWhite" },
      { name: "Latte", price: "6300", foto: "latte" },
      {
        name: "Latte saborizado",
        description: "Vainilla, pistacho, caramel o avellanas.",
        price: "6600",
        foto: "latteSaborizado",
      },
      { name: "Flat white", price: "6300", foto: "flatWhite" },
      { name: "Capuccino", price: "5600", foto: "capuccino" },
      { name: "Capuccino doble", price: "6600", foto: "capuccino" },
      { name: "Mocaccino", price: "6600", foto: "mocaccino" },
      { name: "Adicional de leche de almendras", price: "1600" },
    ],
  },
  {
    name: "Café frío",
    tagline: "Con mucho hielo",
    foto: "catCafeFrio",
    productos: [
      { name: "Cold brew", price: "4700", foto: "coldBrew" },
      { name: "Iced americano", price: "4300", foto: "icedAmericano" },
      { name: "Iced flat white", price: "6400", foto: "icedFlatWhite" },
      { name: "Iced latte", price: "6400", foto: "icedLatte" },
      {
        name: "Iced latte saborizado",
        description: "Vainilla, pistacho, caramel o avellanas.",
        price: "6700",
        foto: "icedSaborizado",
      },
    ],
  },
  {
    name: "Otras bebidas",
    tagline: "Jugos, licuados y más",
    foto: "catBebidas",
    productos: [
      { name: "Limonada", price: "5500", foto: "limonada" },
      { name: "Agua mineral", price: "4200" },
      { name: "Exprimido de naranja", price: "5100", foto: "exprimido" },
      { name: "Medio exprimido", price: "3800", foto: "exprimido" },
      { name: "Licuado 1 fruta", price: "5500", foto: "licuado" },
      { name: "Licuado 2 frutas", price: "6500", foto: "licuado2" },
      { name: "Gaseosa", price: "4200" },
      { name: "Chocolatada", price: "4500", foto: "chocolatada" },
      { name: "Té Twinings", price: "4500", foto: "te" },
      { name: "Submarino", price: "5000", foto: "submarino" },
    ],
  },
];

interface ComboSeed {
  name: string;
  description: string;
  price: string;
  foto: FotoKey;
  /** Lo que el combo trae y existe como producto suelto. El café con leche grande no está suelto en la carta. */
  items: { producto: string; cantidad: number }[];
}

const COMBOS: ComboSeed[] = [
  {
    name: "Clásico",
    description: "Café con leche grande + 1/2 exprimido + 2 medialunas.",
    price: "13000",
    foto: "catCombos",
    items: [
      { producto: "Medio exprimido", cantidad: 1 },
      { producto: "Medialuna", cantidad: 2 },
    ],
  },
  {
    name: "Tropical",
    description: "Café con leche grande + banana toast.",
    price: "13900",
    foto: "comboTropical",
    items: [{ producto: "Banana toast", cantidad: 1 }],
  },
  {
    name: "Tradicional",
    description: "Café con leche grande + 1/2 exprimido + porción de tostadas.",
    price: "16100",
    foto: "comboTradicional",
    items: [
      { producto: "Medio exprimido", cantidad: 1 },
      { producto: "Tostadas con mermelada y queso", cantidad: 1 },
    ],
  },
  {
    name: "Protéico",
    description: "Café con leche grande + tostado pan de molde con huevo.",
    price: "19200",
    foto: "comboProteico",
    items: [{ producto: "Tostado pan de molde", cantidad: 1 }],
  },
  {
    name: "Preferido",
    description: "Café con leche grande + 1/2 exprimido + avocado toast.",
    price: "20200",
    foto: "comboPreferido",
    items: [
      { producto: "Medio exprimido", cantidad: 1 },
      { producto: "Avocado toast", cantidad: 1 },
    ],
  },
  {
    name: "Saludable",
    description:
      "Café con leche grande + 1/2 exprimido + tostón huevos revueltos + porción de frutas.",
    price: "21300",
    foto: "comboSaludable",
    items: [
      { producto: "Medio exprimido", cantidad: 1 },
      { producto: "Tostón huevos revueltos", cantidad: 1 },
    ],
  },
];

/** Un salón chico de café: mesas para dos sobre la ventana, cuatro de cuatro y una barra. */
const SALON = { columnas: 20, filas: 12 };
const MESAS: {
  number: number;
  seats: number;
  shape: "redonda" | "cuadrada" | "rectangular";
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { number: 1, seats: 2, shape: "redonda", x: 1, y: 1, w: 2, h: 2 },
  { number: 2, seats: 2, shape: "redonda", x: 5, y: 1, w: 2, h: 2 },
  { number: 3, seats: 2, shape: "redonda", x: 9, y: 1, w: 2, h: 2 },
  { number: 4, seats: 4, shape: "cuadrada", x: 1, y: 5, w: 3, h: 3 },
  { number: 5, seats: 4, shape: "cuadrada", x: 6, y: 5, w: 3, h: 3 },
  { number: 6, seats: 4, shape: "cuadrada", x: 11, y: 5, w: 3, h: 3 },
  { number: 7, seats: 6, shape: "rectangular", x: 2, y: 9, w: 6, h: 2 },
  { number: 8, seats: 4, shape: "rectangular", x: 15, y: 1, w: 2, h: 9 },
];

// ---------- Alta ----------

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
      .set({ ...MODULOS, name: NOMBRE, primaryColor: ROJO, active: true })
      .where(eq(companies.id, existente.id));
    return existente.id;
  }

  const [{ id }] = await db
    .insert(companies)
    .values({ ...MODULOS, name: NOMBRE, slug: SLUG, primaryColor: ROJO, active: true })
    .$returningId();
  console.log(`Empresa creada (id ${id}).`);
  return id;
}

async function sucursalYDuenio(companyId: number) {
  const [local] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.companyId, companyId))
    .limit(1);

  let locationId = local?.id;
  if (!locationId) {
    const [{ id }] = await db
      .insert(locations)
      .values({ companyId, name: SUCURSAL, slug: SLUG_SUCURSAL, active: true })
      .$returningId();
    locationId = id;
    console.log("Sucursal creada.");
  }

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
        email: "nastymondays@totempoint.com",
        username: USUARIO,
        passwordHash: await hashPassword(CLAVE),
        companyId,
        locationId,
        active: true,
      })
      .$returningId();
    await db.insert(userRoles).values({ userId, role: "owner" });
    await db.insert(userLocations).values({ userId, locationId });
    console.log(`Dueño creado: ${USUARIO}${process.env.NASTY_CLAVE ? "" : ` / ${CLAVE}`}.`);
  } else {
    console.log("El dueño ya existía, no se toca.");
  }

  // Retiro y efectivo: el envío necesita marcar la sucursal en el mapa, desde el panel.
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

async function salon(companyId: number, locationId: number) {
  await db
    .insert(diningRooms)
    .values({ locationId, columns: SALON.columnas, rows: SALON.filas })
    .onDuplicateKeyUpdate({ set: { columns: SALON.columnas, rows: SALON.filas } });
  await db
    .insert(mesaSettings)
    .values({ companyId, autoAccept: true })
    .onDuplicateKeyUpdate({ set: { autoAccept: true } });

  // Las mesas que ya existen conservan su token: un QR ya impreso o mandado sigue andando.
  const existentes = await db
    .select({ id: diningTables.id, number: diningTables.number })
    .from(diningTables)
    .where(eq(diningTables.locationId, locationId));
  const porNumero = new Map(existentes.map((m) => [m.number, m.id]));

  for (const m of MESAS) {
    const id = porNumero.get(m.number);
    if (id) {
      await db
        .update(diningTables)
        .set({ ...m, active: true })
        .where(eq(diningTables.id, id));
    } else {
      await db
        .insert(diningTables)
        .values({ ...m, locationId, active: true, token: randomBytes(12).toString("base64url") });
    }
  }
  const sobran = existentes.filter((e) => !MESAS.some((m) => m.number === e.number));
  if (sobran.length > 0) {
    await db.delete(diningTables).where(
      inArray(
        diningTables.id,
        sobran.map((s) => s.id),
      ),
    );
  }
  console.log(`Salón armado: ${MESAS.length} mesas.`);
}

async function limpiarCatalogo(companyId: number) {
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
  await db.delete(products).where(eq(products.companyId, companyId));
  await db.delete(categories).where(eq(categories.companyId, companyId));
}

async function main() {
  // Un dueño con contraseña débil no puede quedar en la base real.
  const [[base]] = (await db.execute(sql`SELECT DATABASE() AS nombre`)) as unknown as [
    { nombre: string }[],
  ];
  if (base.nombre === "railway") {
    const chequeo = checkPassword(process.env.NASTY_CLAVE ?? "");
    if (!process.env.NASTY_CLAVE || !chequeo.ok) {
      console.error(
        "En producción pasá en NASTY_CLAVE una contraseña que cumpla la regla:",
        chequeo.problemas.join(", "),
      );
      process.exit(1);
    }
  }

  const companyId = await empresa();
  const locationId = await sucursalYDuenio(companyId);
  await limpiarCatalogo(companyId);
  const motivos = await cargarMotivosBase(companyId);
  if (motivos > 0) console.log(`${motivos} motivos de movimiento cargados.`);
  await salon(companyId, locationId);

  // Logo
  if (LOGO) {
    const data = readFileSync(LOGO);
    const mimeType = formatoDeImagen(data);
    if (!mimeType) throw new Error(`El logo ${LOGO} no es una imagen que se pueda servir`);
    const [{ id: logoId }] = await db
      .insert(images)
      .values({ companyId, mimeType, data })
      .$returningId();
    await db
      .update(companies)
      .set({ logoUrl: `/img/${logoId}` })
      .where(eq(companies.id, companyId));
    console.log("Logo cargado.");
  }

  // Catálogo
  const idPorNombre = new Map<string, number>();
  for (const [i, cat] of CATALOGO.entries()) {
    const photoUrl = await foto(companyId, cat.foto);
    const [{ id: categoryId }] = await db
      .insert(categories)
      .values({ companyId, name: cat.name, tagline: cat.tagline, photoUrl, sort: i, active: true })
      .$returningId();

    for (const [j, p] of cat.productos.entries()) {
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
          sort: j,
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

  // Portada del tótem: crema de fondo, rojo de acento y la tipografía condensada del menú.
  const portada = await foto(companyId, "portada");
  const ajustes = {
    companyId,
    template: "split" as const,
    theme: "arena" as const,
    fontTheme: "impacto" as const,
    corners: "suave" as const,
    heroImageUrl: portada,
    eyebrow: "Café de especialidad · Mar del Plata",
    title: "Nasty",
    titleAccent: "Mondays",
    subtitle:
      "Rolls, donas y café de especialidad, frescos del día. Pedí acá y te avisamos cuando esté.",
    ctaLabel: "Pedir",
    badge1: "Frescos del día",
    badge2: "Opciones sin TACC",
    accentColor: ROJO,
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

  const mesa1 = await db
    .select({ token: diningTables.token })
    .from(diningTables)
    .where(and(eq(diningTables.locationId, locationId), eq(diningTables.number, 1)))
    .limit(1);
  console.log(
    `\nListo.\n  Tótem:  /t/${SLUG}/${SLUG_SUCURSAL}/1\n  Online: /p/${SLUG}/${SLUG_SUCURSAL}\n  Mesa 1: /m/${mesa1[0]?.token}\n  Panel:  ${USUARIO} / ${CLAVE}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
