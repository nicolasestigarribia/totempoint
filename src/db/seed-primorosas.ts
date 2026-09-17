/**
 * Carga un catálogo de demostración para una sanguchería de miga: categorías,
 * productos, combos y la portada del tótem.
 *
 * Todo queda en la base como cualquier catálogo cargado desde el panel: nada
 * hardcodeado en el código de las pantallas. Las fotos se generan acá como SVG
 * y se guardan en la tabla `images`, igual que una subida del panel, así que se
 * sirven por /img/:id y se pueden reemplazar desde el admin sin tocar nada.
 *
 * Correr con:  bun run src/db/seed-primorosas.ts [slug]
 * Por defecto usa el slug "sangucheria-primorosas".
 * Es idempotente: borra el catálogo anterior de esa empresa y lo vuelve a crear.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  companies,
  categories,
  products,
  combos,
  comboProducts,
  images,
  totemSettings,
} from "./schema";

const slug = process.argv[2] ?? "sangucheria-primorosas";

// ---------- Ilustraciones ----------
// Cada producto lleva un SVG propio: fondo cálido, el sanguche dibujado con los
// colores de su relleno y el nombre abajo. No son fotos de stock: son de la casa
// y no dependen de ningún servicio externo.

type Art =
  | { kind: "miga"; filling: string; extra?: string }
  | { kind: "triple"; filling: string; extra?: string }
  | { kind: "bebida"; body: string; cap: string }
  | { kind: "dulce"; body: string; top: string };

const MIGA_BREAD = "#fdf6e8";
const MIGA_SHADOW = "#e8dcc2";

function svgShell(bg1: string, bg2: string, inner: string, caption: string) {
  const label = caption
    ? `<rect y="430" width="800" height="170" fill="url(#fade)"/>
  <text x="400" y="556" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="44" fill="#fff" letter-spacing="1">${caption}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <ellipse cx="400" cy="470" rx="250" ry="42" fill="#000" opacity="0.13"/>
  ${inner}
  ${label}
</svg>`;
}

/** Dos triángulos de miga apilados, como salen en la bandeja. */
function migaInner(filling: string, extra?: string) {
  const layer = (x: number, y: number, rot: number) => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <polygon points="0,0 300,0 150,215" fill="${MIGA_BREAD}"/>
      <polygon points="0,0 300,0 150,215" fill="none" stroke="${MIGA_SHADOW}" stroke-width="4"/>
      <polygon points="8,96 292,96 150,198" fill="${filling}" opacity="0.95"/>
      ${extra ? `<polygon points="14,112 286,112 150,180" fill="${extra}" opacity="0.9"/>` : ""}
      <polygon points="8,84 292,84 292,96 8,96" fill="${MIGA_SHADOW}" opacity="0.6"/>
    </g>`;
  return `${layer(230, 150, -6)}${layer(300, 205, 7)}`;
}

/** Triple: tres pisos, corte alto. */
function tripleInner(filling: string, extra?: string) {
  const slice = (y: number) => `
    <rect x="285" y="${y}" width="230" height="34" rx="6" fill="${MIGA_BREAD}" stroke="${MIGA_SHADOW}" stroke-width="3"/>`;
  return `
    <g transform="rotate(-4 400 330)">
      ${slice(150)}
      <rect x="292" y="184" width="216" height="26" rx="4" fill="${filling}"/>
      ${slice(210)}
      <rect x="292" y="244" width="216" height="26" rx="4" fill="${extra ?? filling}"/>
      ${slice(270)}
      <rect x="292" y="304" width="216" height="26" rx="4" fill="${filling}" opacity="0.85"/>
      ${slice(330)}
    </g>`;
}

function bebidaInner(body: string, cap: string) {
  return `
    <g transform="translate(340 120)">
      <rect x="18" y="0" width="84" height="34" rx="10" fill="${cap}"/>
      <path d="M30 34 h60 l22 60 v200 a26 26 0 0 1 -26 26 h-52 a26 26 0 0 1 -26 -26 v-200 z" fill="${body}"/>
      <rect x="34" y="150" width="52" height="86" rx="8" fill="#fff" opacity="0.85"/>
      <rect x="22" y="60" width="14" height="210" rx="7" fill="#fff" opacity="0.25"/>
    </g>`;
}

function dulceInner(body: string, top: string) {
  return `
    <g transform="translate(400 300)">
      <circle r="140" fill="${body}"/>
      <circle r="140" fill="none" stroke="#00000022" stroke-width="6"/>
      <path d="M-140 0 a140 140 0 0 1 280 0 z" fill="${top}" opacity="0.9"/>
      <circle cy="-10" r="52" fill="#fff" opacity="0.5"/>
    </g>`;
}

function artSvg(art: Art, caption: string) {
  switch (art.kind) {
    case "miga":
      return svgShell("#f6c453", "#e08b3c", migaInner(art.filling, art.extra), caption);
    case "triple":
      return svgShell("#7bb7a0", "#2f7a63", tripleInner(art.filling, art.extra), caption);
    case "bebida":
      return svgShell("#8fb8e8", "#3d6fb0", bebidaInner(art.body, art.cap), caption);
    case "dulce":
      return svgShell("#e9a6b8", "#b8556f", dulceInner(art.body, art.top), caption);
  }
}

async function saveArt(companyId: number, art: Art, caption: string): Promise<string> {
  const svg = artSvg(art, caption);
  const [{ id }] = await db
    .insert(images)
    .values({
      companyId,
      mimeType: "image/svg+xml",
      data: Buffer.from(svg, "utf8").toString("base64"),
    })
    .$returningId();
  return `/img/${id}`;
}

/** Logo redondo de la marca: iniciales sobre el color de la casa. */
function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6c453"/><stop offset="1" stop-color="#e08b3c"/>
  </linearGradient></defs>
  <circle cx="120" cy="120" r="120" fill="url(#g)"/>
  <polygon points="58,150 182,150 120,60" fill="#fdf6e8"/>
  <polygon points="72,132 168,132 120,96" fill="#f2a0a0"/>
  <text x="120" y="205" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#4a2c12">PR</text>
</svg>`;
}

// ---------- El catálogo ----------

interface ProductSeed {
  name: string;
  description: string;
  price: string;
  art: Art;
  stockable?: boolean;
  unit?: string;
}

interface CategorySeed {
  name: string;
  tagline: string;
  art: Art;
  products: ProductSeed[];
}

const CATALOG: CategorySeed[] = [
  {
    name: "Sanguches de miga",
    tagline: "Por unidad, recién cortados",
    art: { kind: "miga", filling: "#f2a0a0", extra: "#ffe38a" },
    products: [
      {
        name: "Jamón y queso",
        description: "Jamón cocido y queso de máquina en pan de miga blanco.",
        price: "1200.00",
        art: { kind: "miga", filling: "#f2a0a0", extra: "#ffe38a" },
      },
      {
        name: "Jamón, queso y morrón",
        description: "El clásico de copetín, con morrón asado y pelado a mano.",
        price: "1400.00",
        art: { kind: "miga", filling: "#f2a0a0", extra: "#e8512f" },
      },
      {
        name: "Salame y queso",
        description: "Salame milán cortado fino con queso cremoso.",
        price: "1350.00",
        art: { kind: "miga", filling: "#c0566a", extra: "#ffe38a" },
      },
      {
        name: "Atún y huevo",
        description: "Atún desmenuzado con huevo duro y un toque de mayonesa.",
        price: "1450.00",
        art: { kind: "miga", filling: "#e7d9b5", extra: "#ffd45e" },
      },
      {
        name: "Berenjena y rúcula",
        description: "Berenjenas en escabeche de la casa con rúcula fresca.",
        price: "1400.00",
        art: { kind: "miga", filling: "#7a5c8c", extra: "#7dbb5a" },
      },
      {
        name: "Palmito y salsa golf",
        description: "Palmitos, lechuga y salsa golf casera.",
        price: "1500.00",
        art: { kind: "miga", filling: "#f4efd6", extra: "#f79a6d" },
      },
    ],
  },
  {
    name: "Triples",
    tagline: "Tres pisos, para el hambre en serio",
    art: { kind: "triple", filling: "#f2a0a0", extra: "#7dbb5a" },
    products: [
      {
        name: "Triple jamón, queso y tomate",
        description: "Tres pisos de miga con tomate cortado en el momento.",
        price: "2300.00",
        art: { kind: "triple", filling: "#f2a0a0", extra: "#e8512f" },
      },
      {
        name: "Triple de pollo",
        description: "Pollo desmenuzado con mayonesa, lechuga y huevo.",
        price: "2600.00",
        art: { kind: "triple", filling: "#efdcae", extra: "#7dbb5a" },
      },
      {
        name: "Triple veggie",
        description: "Queso, tomate, lechuga, zanahoria rallada y huevo.",
        price: "2400.00",
        art: { kind: "triple", filling: "#7dbb5a", extra: "#f6a93b" },
      },
    ],
  },
  {
    name: "Bebidas",
    tagline: "Bien frías",
    art: { kind: "bebida", body: "#c8342f", cap: "#8f1f1c" },
    products: [
      {
        name: "Gaseosa línea Coca 500 ml",
        description: "Coca-Cola, Sprite o Fanta, en botella de 500 ml.",
        price: "1500.00",
        art: { kind: "bebida", body: "#c8342f", cap: "#8f1f1c" },
        stockable: true,
        unit: "botella",
      },
      {
        name: "Agua saborizada 500 ml",
        description: "Pomelo o manzana, sin azúcar agregada.",
        price: "1300.00",
        art: { kind: "bebida", body: "#63b3c7", cap: "#2f7f93" },
        stockable: true,
        unit: "botella",
      },
      {
        name: "Exprimido de naranja",
        description: "Naranjas exprimidas al momento, vaso de 400 ml.",
        price: "1800.00",
        art: { kind: "bebida", body: "#f6a93b", cap: "#d2761b" },
      },
    ],
  },
  {
    name: "Para el café",
    tagline: "Dulces de la casa",
    art: { kind: "dulce", body: "#f0d9a8", top: "#ffffff" },
    products: [
      {
        name: "Alfajor de maicena",
        description: "Dulce de leche repostero y coco rallado.",
        price: "900.00",
        art: { kind: "dulce", body: "#f0d9a8", top: "#ffffff" },
      },
      {
        name: "Budín de limón",
        description: "Porción de budín casero con glasé de limón.",
        price: "1100.00",
        art: { kind: "dulce", body: "#f3d86b", top: "#fffdf2" },
      },
    ],
  },
];

interface ComboSeed {
  name: string;
  description: string;
  price: string;
  items: { product: string; quantity: number }[];
  art: Art;
}

const COMBOS: ComboSeed[] = [
  {
    name: "Combo mediodía",
    description: "Dos sanguches de miga a elección y una bebida de 500 ml.",
    price: "3600.00",
    items: [
      { product: "Jamón y queso", quantity: 2 },
      { product: "Gaseosa línea Coca 500 ml", quantity: 1 },
    ],
    art: { kind: "miga", filling: "#f2a0a0", extra: "#ffe38a" },
  },
  {
    name: "Combo triple",
    description: "Un triple, una bebida y un alfajor de maicena.",
    price: "4700.00",
    items: [
      { product: "Triple jamón, queso y tomate", quantity: 1 },
      { product: "Agua saborizada 500 ml", quantity: 1 },
      { product: "Alfajor de maicena", quantity: 1 },
    ],
    art: { kind: "triple", filling: "#f2a0a0", extra: "#e8512f" },
  },
  {
    name: "Media docena surtida",
    description: "Seis sanguches de miga surtidos para compartir.",
    price: "6900.00",
    items: [
      { product: "Jamón y queso", quantity: 2 },
      { product: "Jamón, queso y morrón", quantity: 2 },
      { product: "Salame y queso", quantity: 2 },
    ],
    art: { kind: "miga", filling: "#c0566a", extra: "#ffe38a" },
  },
];

async function main() {
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!company) throw new Error(`No existe ninguna empresa con el slug "${slug}"`);
  const companyId = company.id;
  console.log(`Cargando catálogo en ${company.name} (id ${companyId})\n`);

  // Borra el catálogo anterior de esta empresa para poder correrlo de nuevo.
  const oldCombos = await db
    .select({ id: combos.id })
    .from(combos)
    .where(eq(combos.companyId, companyId));
  if (oldCombos.length > 0) {
    await db.delete(comboProducts).where(
      inArray(
        comboProducts.comboId,
        oldCombos.map((c) => c.id),
      ),
    );
  }
  await db.delete(combos).where(eq(combos.companyId, companyId));
  await db.delete(products).where(eq(products.companyId, companyId));
  await db.delete(categories).where(eq(categories.companyId, companyId));
  await db.delete(images).where(eq(images.companyId, companyId));
  console.log("Catálogo anterior borrado.");

  const productIdByName = new Map<string, number>();

  let catSort = 0;
  for (const cat of CATALOG) {
    const photoUrl = await saveArt(companyId, cat.art, cat.name);
    const [{ id: categoryId }] = await db
      .insert(categories)
      .values({
        companyId,
        name: cat.name,
        tagline: cat.tagline,
        photoUrl,
        sort: catSort++,
        active: true,
      })
      .$returningId();

    let prodSort = 0;
    for (const p of cat.products) {
      const productPhoto = await saveArt(companyId, p.art, p.name);
      const [{ id: productId }] = await db
        .insert(products)
        .values({
          companyId,
          categoryId,
          name: p.name,
          description: p.description,
          price: p.price,
          photoUrl: productPhoto,
          stockable: p.stockable ?? false,
          unit: p.unit ?? null,
          sort: prodSort++,
          active: true,
        })
        .$returningId();
      productIdByName.set(p.name, productId);
    }
    console.log(`  ${cat.name}: ${cat.products.length} productos`);
  }

  let comboSort = 0;
  for (const c of COMBOS) {
    const photoUrl = await saveArt(companyId, c.art, c.name);
    const [{ id: comboId }] = await db
      .insert(combos)
      .values({
        companyId,
        name: c.name,
        description: c.description,
        price: c.price,
        photoUrl,
        sort: comboSort++,
        active: true,
      })
      .$returningId();

    for (const item of c.items) {
      const productId = productIdByName.get(item.product);
      if (!productId)
        throw new Error(`El combo "${c.name}" apunta a "${item.product}", que no existe`);
      await db.insert(comboProducts).values({ comboId, productId, quantity: item.quantity });
    }
  }
  console.log(`  Combos: ${COMBOS.length}`);

  // Portada del tótem, para que la pantalla de inicio no quede vacía.
  const heroUrl = await saveArt(
    companyId,
    { kind: "miga", filling: "#f2a0a0", extra: "#ffe38a" },
    "",
  );

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
    .set({ logoUrl: `/img/${logoId}`, primaryColor: "#e08b3c" })
    .where(eq(companies.id, companyId));
  console.log("  Logo y color de la marca cargados");
  const cover = {
    template: "split" as const,
    heroImageUrl: heroUrl,
    eyebrow: "Sanguchería de miga",
    title: "Recién",
    titleAccent: "cortados",
    subtitle:
      "Miga fresca todos los días. Armá tu pedido en la pantalla y retiralo en el mostrador.",
    ctaLabel: "Empezar pedido",
    badge1: "Listo en 5 min",
    badge2: "Miga del día",
    accentColor: "#e08b3c",
  };
  await db
    .insert(totemSettings)
    .values({ companyId, ...cover })
    .onDuplicateKeyUpdate({ set: cover });
  console.log("  Portada del tótem configurada");

  const total = CATALOG.reduce((n, c) => n + c.products.length, 0);
  console.log(
    `\nListo: ${CATALOG.length} categorías, ${total} productos, ${COMBOS.length} combos.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
