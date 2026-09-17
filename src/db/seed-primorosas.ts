/**
 * Carga un catálogo completo de demostración para una sanguchería de miga:
 * categorías, productos con receta, ingredientes, combos y la portada del tótem.
 *
 * Todo queda en la base como cualquier catálogo cargado desde el panel: nada
 * hardcodeado en las pantallas. Las fotos se bajan de Pexels (licencia libre,
 * uso comercial sin atribución) y se guardan en la tabla `images` igual que una
 * subida del panel, así que se sirven por /img/:id y se pueden reemplazar desde
 * el admin sin tocar código.
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
  productIngredients,
  ingredients,
  ingredientCategories,
  combos,
  comboProducts,
  images,
  totemSettings,
} from "./schema";

const slug = process.argv[2] ?? "sangucheria-primorosas";

// ---------- Fotos ----------
// Cada clave apunta a una foto de Pexels. El ancho se pide en la URL para no
// guardar un archivo de 3 MB en la base por cada producto.
const ANCHO = 900;
const BASE = "https://images.pexels.com/photos";

// Cada foto se nombra con su ruta completa: Pexels usa dos formatos de archivo
// según la antigüedad de la publicación, así que no alcanza con el número.
const FOTOS = {
  portada: "5112543/pexels-photo-5112543.jpeg",
  catSanguches:
    "31742775/pexels-photo-31742775/free-photo-of-delicious-sandwich-platter-with-fresh-ingredients.jpeg",
  catTriples: "15362507/pexels-photo-15362507/free-photo-of-sandwiches-on-a-plate.jpeg",
  catBebidas: "14373170/pexels-photo-14373170.jpeg",
  catCafe:
    "34472658/pexels-photo-34472658/free-photo-of-cozy-coffee-break-with-dulce-de-leche-and-biscuits.jpeg",

  jamonQueso:
    "18784895/pexels-photo-18784895/free-photo-of-ham-sandwich-on-a-plate-with-a-flower.jpeg",
  jamonQuesoMorron: "16436249/pexels-photo-16436249/free-photo-of-sandwiches-on-plate.jpeg",
  salameQueso: "5794873/pexels-photo-5794873.jpeg",
  atunHuevo: "13059938/pexels-photo-13059938.jpeg",
  berenjena:
    "34644321/pexels-photo-34644321/free-photo-of-fresh-gourmet-sandwiches-with-arugula-and-tomato.jpeg",
  palmito: "7736773/pexels-photo-7736773.jpeg",

  tripleClasico: "15662232/pexels-photo-15662232/free-photo-of-sandwitch-on-plate.jpeg",
  triplePollo: "19202829/pexels-photo-19202829/free-photo-of-sandwiches-on-plate.jpeg",
  tripleVeggie: "5639689/pexels-photo-5639689.jpeg",

  gaseosa: "7414290/pexels-photo-7414290.jpeg",
  agua: "31107435/pexels-photo-31107435/free-photo-of-elegant-table-setting-with-bottled-water.jpeg",
  exprimido: "158053/fresh-orange-juice-squeezed-refreshing-citrus-158053.jpeg",

  alfajor: "17358380/pexels-photo-17358380/free-photo-of-tower-of-argentinian-cookies.jpeg",
  budin:
    "36673263/pexels-photo-36673263/free-photo-of-slice-of-lemon-cake-on-reflective-surface.jpeg",

  comboMediodia: "5639683/pexels-photo-5639683.jpeg",
  comboTriple: "5639687/pexels-photo-5639687.jpeg",
  comboDocena: "16222106/pexels-photo-16222106/free-photo-of-food-on-plate.jpeg",
} as const;

type FotoKey = keyof typeof FOTOS;

const urlDeFoto = (ruta: string) => `${BASE}/${ruta}?auto=compress&cs=tinysrgb&w=${ANCHO}`;

/** Baja una foto una sola vez y la guarda en la base; devuelve su /img/:id. */
const cache = new Map<FotoKey, string>();
async function foto(companyId: number, key: FotoKey): Promise<string> {
  const guardada = cache.get(key);
  if (guardada) return guardada;

  const url = urlDeFoto(FOTOS[key]);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar la foto ${key} (${res.status})`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");

  const [{ id }] = await db.insert(images).values({ companyId, mimeType, data }).$returningId();
  const ruta = `/img/${id}`;
  cache.set(key, ruta);
  return ruta;
}

/**
 * Logo de la marca. Este sí es dibujado y no una foto: un logo de stock sería
 * el logo de otro. Es un SVG, así que se ve nítido en cualquier tamaño.
 */
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

// ---------- Ingredientes ----------
// El costo es unitario y en pesos, para que el panel pueda costear la receta.

interface IngredienteSeed {
  name: string;
  categoria: string;
  unit: string;
  cost: string;
}

const CATEGORIAS_INGREDIENTES = [
  "Panificados",
  "Fiambres",
  "Lácteos",
  "Verdulería",
  "Conservas",
  "Bebidas",
  "Dulces",
];

const INGREDIENTES: IngredienteSeed[] = [
  { name: "Pan de miga blanco", categoria: "Panificados", unit: "plancha", cost: "2200" },
  { name: "Pan de miga negro", categoria: "Panificados", unit: "plancha", cost: "2600" },
  { name: "Jamón cocido", categoria: "Fiambres", unit: "kg", cost: "9800" },
  { name: "Salame milán", categoria: "Fiambres", unit: "kg", cost: "12400" },
  { name: "Queso de máquina", categoria: "Lácteos", unit: "kg", cost: "11200" },
  { name: "Queso crema", categoria: "Lácteos", unit: "kg", cost: "6800" },
  { name: "Manteca", categoria: "Lácteos", unit: "kg", cost: "7400" },
  { name: "Tomate", categoria: "Verdulería", unit: "kg", cost: "1900" },
  { name: "Lechuga", categoria: "Verdulería", unit: "planta", cost: "1200" },
  { name: "Rúcula", categoria: "Verdulería", unit: "atado", cost: "1500" },
  { name: "Zanahoria", categoria: "Verdulería", unit: "kg", cost: "1400" },
  { name: "Huevo", categoria: "Verdulería", unit: "docena", cost: "3600" },
  { name: "Morrón asado", categoria: "Conservas", unit: "frasco", cost: "3200" },
  { name: "Atún al natural", categoria: "Conservas", unit: "lata", cost: "2800" },
  { name: "Palmito", categoria: "Conservas", unit: "lata", cost: "4100" },
  { name: "Berenjena en escabeche", categoria: "Conservas", unit: "frasco", cost: "3500" },
  { name: "Mayonesa", categoria: "Conservas", unit: "kg", cost: "4200" },
  { name: "Salsa golf", categoria: "Conservas", unit: "kg", cost: "4400" },
  { name: "Pollo desmenuzado", categoria: "Fiambres", unit: "kg", cost: "8900" },
  { name: "Naranja", categoria: "Verdulería", unit: "kg", cost: "1600" },
  { name: "Dulce de leche repostero", categoria: "Dulces", unit: "kg", cost: "6200" },
  { name: "Limón", categoria: "Verdulería", unit: "kg", cost: "1800" },
];

// ---------- El catálogo ----------

interface ProductSeed {
  name: string;
  description: string;
  price: string;
  foto: FotoKey;
  /** Receta: qué lleva y cuánto, en la unidad del ingrediente. */
  receta?: { ingrediente: string; cantidad: string }[];
  stockable?: boolean;
  unit?: string;
}

interface CategorySeed {
  name: string;
  tagline: string;
  foto: FotoKey;
  products: ProductSeed[];
}

const CATALOG: CategorySeed[] = [
  {
    name: "Sanguches de miga",
    tagline: "Por unidad, recién cortados",
    foto: "catSanguches",
    products: [
      {
        name: "Jamón y queso",
        description: "Jamón cocido y queso de máquina en pan de miga blanco.",
        price: "1200.00",
        foto: "jamonQueso",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.08" },
          { ingrediente: "Jamón cocido", cantidad: "0.03" },
          { ingrediente: "Queso de máquina", cantidad: "0.03" },
          { ingrediente: "Manteca", cantidad: "0.01" },
        ],
      },
      {
        name: "Jamón, queso y morrón",
        description: "El clásico de copetín, con morrón asado y pelado a mano.",
        price: "1400.00",
        foto: "jamonQuesoMorron",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.08" },
          { ingrediente: "Jamón cocido", cantidad: "0.03" },
          { ingrediente: "Queso de máquina", cantidad: "0.03" },
          { ingrediente: "Morrón asado", cantidad: "0.05" },
        ],
      },
      {
        name: "Salame y queso",
        description: "Salame milán cortado fino con queso cremoso.",
        price: "1350.00",
        foto: "salameQueso",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.08" },
          { ingrediente: "Salame milán", cantidad: "0.03" },
          { ingrediente: "Queso crema", cantidad: "0.02" },
        ],
      },
      {
        name: "Atún y huevo",
        description: "Atún desmenuzado con huevo duro y un toque de mayonesa.",
        price: "1450.00",
        foto: "atunHuevo",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.08" },
          { ingrediente: "Atún al natural", cantidad: "0.5" },
          { ingrediente: "Huevo", cantidad: "0.08" },
          { ingrediente: "Mayonesa", cantidad: "0.02" },
        ],
      },
      {
        name: "Berenjena y rúcula",
        description: "Berenjenas en escabeche de la casa con rúcula fresca.",
        price: "1400.00",
        foto: "berenjena",
        receta: [
          { ingrediente: "Pan de miga negro", cantidad: "0.08" },
          { ingrediente: "Berenjena en escabeche", cantidad: "0.1" },
          { ingrediente: "Rúcula", cantidad: "0.05" },
        ],
      },
      {
        name: "Palmito y salsa golf",
        description: "Palmitos, lechuga y salsa golf casera.",
        price: "1500.00",
        foto: "palmito",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.08" },
          { ingrediente: "Palmito", cantidad: "0.25" },
          { ingrediente: "Lechuga", cantidad: "0.1" },
          { ingrediente: "Salsa golf", cantidad: "0.02" },
        ],
      },
    ],
  },
  {
    name: "Triples",
    tagline: "Tres pisos, para el hambre en serio",
    foto: "catTriples",
    products: [
      {
        name: "Triple jamón, queso y tomate",
        description: "Tres pisos de miga con tomate cortado en el momento.",
        price: "2300.00",
        foto: "tripleClasico",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.16" },
          { ingrediente: "Jamón cocido", cantidad: "0.05" },
          { ingrediente: "Queso de máquina", cantidad: "0.05" },
          { ingrediente: "Tomate", cantidad: "0.08" },
        ],
      },
      {
        name: "Triple de pollo",
        description: "Pollo desmenuzado con mayonesa, lechuga y huevo.",
        price: "2600.00",
        foto: "triplePollo",
        receta: [
          { ingrediente: "Pan de miga blanco", cantidad: "0.16" },
          { ingrediente: "Pollo desmenuzado", cantidad: "0.08" },
          { ingrediente: "Mayonesa", cantidad: "0.03" },
          { ingrediente: "Lechuga", cantidad: "0.1" },
          { ingrediente: "Huevo", cantidad: "0.08" },
        ],
      },
      {
        name: "Triple veggie",
        description: "Queso, tomate, lechuga, zanahoria rallada y huevo.",
        price: "2400.00",
        foto: "tripleVeggie",
        receta: [
          { ingrediente: "Pan de miga negro", cantidad: "0.16" },
          { ingrediente: "Queso de máquina", cantidad: "0.05" },
          { ingrediente: "Tomate", cantidad: "0.08" },
          { ingrediente: "Lechuga", cantidad: "0.1" },
          { ingrediente: "Zanahoria", cantidad: "0.05" },
          { ingrediente: "Huevo", cantidad: "0.08" },
        ],
      },
    ],
  },
  {
    name: "Bebidas",
    tagline: "Bien frías",
    foto: "catBebidas",
    products: [
      {
        name: "Gaseosa línea Coca 500 ml",
        description: "Coca-Cola, Sprite o Fanta, en botella de 500 ml.",
        price: "1500.00",
        foto: "gaseosa",
        stockable: true,
        unit: "botella",
      },
      {
        name: "Agua saborizada 500 ml",
        description: "Pomelo o manzana, sin azúcar agregada.",
        price: "1300.00",
        foto: "agua",
        stockable: true,
        unit: "botella",
      },
      {
        name: "Exprimido de naranja",
        description: "Naranjas exprimidas al momento, vaso de 400 ml.",
        price: "1800.00",
        foto: "exprimido",
        receta: [{ ingrediente: "Naranja", cantidad: "0.5" }],
      },
    ],
  },
  {
    name: "Para el café",
    tagline: "Dulces de la casa",
    foto: "catCafe",
    products: [
      {
        name: "Alfajor de maicena",
        description: "Dulce de leche repostero y coco rallado.",
        price: "900.00",
        foto: "alfajor",
        receta: [{ ingrediente: "Dulce de leche repostero", cantidad: "0.04" }],
      },
      {
        name: "Budín de limón",
        description: "Porción de budín casero con glasé de limón.",
        price: "1100.00",
        foto: "budin",
        receta: [
          { ingrediente: "Limón", cantidad: "0.05" },
          { ingrediente: "Huevo", cantidad: "0.08" },
          { ingrediente: "Manteca", cantidad: "0.03" },
        ],
      },
    ],
  },
];

interface ComboSeed {
  name: string;
  description: string;
  price: string;
  foto: FotoKey;
  items: { product: string; quantity: number }[];
}

const COMBOS: ComboSeed[] = [
  {
    name: "Combo mediodía",
    description: "Dos sanguches de miga a elección y una bebida de 500 ml.",
    price: "3600.00",
    foto: "comboMediodia",
    items: [
      { product: "Jamón y queso", quantity: 2 },
      { product: "Gaseosa línea Coca 500 ml", quantity: 1 },
    ],
  },
  {
    name: "Combo triple",
    description: "Un triple, una bebida y un alfajor de maicena.",
    price: "4700.00",
    foto: "comboTriple",
    items: [
      { product: "Triple jamón, queso y tomate", quantity: 1 },
      { product: "Agua saborizada 500 ml", quantity: 1 },
      { product: "Alfajor de maicena", quantity: 1 },
    ],
  },
  {
    name: "Media docena surtida",
    description: "Seis sanguches de miga surtidos para compartir.",
    price: "6900.00",
    foto: "comboDocena",
    items: [
      { product: "Jamón y queso", quantity: 2 },
      { product: "Jamón, queso y morrón", quantity: 2 },
      { product: "Salame y queso", quantity: 2 },
    ],
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
  const viejosProductos = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.companyId, companyId));
  if (viejosProductos.length > 0) {
    await db.delete(productIngredients).where(
      inArray(
        productIngredients.productId,
        viejosProductos.map((p) => p.id),
      ),
    );
  }
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
  }
  await db.delete(combos).where(eq(combos.companyId, companyId));
  await db.delete(products).where(eq(products.companyId, companyId));
  await db.delete(categories).where(eq(categories.companyId, companyId));
  await db.delete(ingredients).where(eq(ingredients.companyId, companyId));
  await db.delete(ingredientCategories).where(eq(ingredientCategories.companyId, companyId));
  await db.delete(images).where(eq(images.companyId, companyId));
  console.log("Catálogo anterior borrado.");

  // Ingredientes, con su categoría.
  const catIngredienteId = new Map<string, number>();
  for (const nombre of CATEGORIAS_INGREDIENTES) {
    const [{ id }] = await db
      .insert(ingredientCategories)
      .values({ companyId, name: nombre, active: true })
      .$returningId();
    catIngredienteId.set(nombre, id);
  }

  const ingredienteId = new Map<string, number>();
  for (const ing of INGREDIENTES) {
    const [{ id }] = await db
      .insert(ingredients)
      .values({
        companyId,
        categoryId: catIngredienteId.get(ing.categoria) ?? null,
        name: ing.name,
        unit: ing.unit,
        cost: ing.cost,
        active: true,
      })
      .$returningId();
    ingredienteId.set(ing.name, id);
  }
  console.log(
    `  Ingredientes: ${INGREDIENTES.length} en ${CATEGORIAS_INGREDIENTES.length} categorías`,
  );

  // Categorías, productos y recetas.
  const productIdByName = new Map<string, number>();
  let catSort = 0;
  for (const cat of CATALOG) {
    const [{ id: categoryId }] = await db
      .insert(categories)
      .values({
        companyId,
        name: cat.name,
        tagline: cat.tagline,
        photoUrl: await foto(companyId, cat.foto),
        sort: catSort++,
        active: true,
      })
      .$returningId();

    let prodSort = 0;
    for (const p of cat.products) {
      const [{ id: productId }] = await db
        .insert(products)
        .values({
          companyId,
          categoryId,
          name: p.name,
          description: p.description,
          price: p.price,
          photoUrl: await foto(companyId, p.foto),
          stockable: p.stockable ?? false,
          unit: p.unit ?? null,
          sort: prodSort++,
          active: true,
        })
        .$returningId();
      productIdByName.set(p.name, productId);

      for (const item of p.receta ?? []) {
        const ingId = ingredienteId.get(item.ingrediente);
        if (!ingId) throw new Error(`"${p.name}" usa "${item.ingrediente}", que no está cargado`);
        await db
          .insert(productIngredients)
          .values({ productId, ingredientId: ingId, quantity: item.cantidad });
      }
    }
    const conReceta = cat.products.filter((p) => p.receta).length;
    console.log(`  ${cat.name}: ${cat.products.length} productos (${conReceta} con receta)`);
  }

  // Combos.
  let comboSort = 0;
  for (const c of COMBOS) {
    const [{ id: comboId }] = await db
      .insert(combos)
      .values({
        companyId,
        name: c.name,
        description: c.description,
        price: c.price,
        photoUrl: await foto(companyId, c.foto),
        sort: comboSort++,
        active: true,
      })
      .$returningId();

    for (const item of c.items) {
      const productId = productIdByName.get(item.product);
      if (!productId) {
        throw new Error(`El combo "${c.name}" apunta a "${item.product}", que no existe`);
      }
      await db.insert(comboProducts).values({ comboId, productId, quantity: item.quantity });
    }
  }
  console.log(`  Combos: ${COMBOS.length}`);

  // Portada del tótem y marca.
  const cover = {
    template: "split" as const,
    heroImageUrl: await foto(companyId, "portada"),
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
  console.log("  Portada, logo y color de la marca configurados");

  const total = CATALOG.reduce((n, c) => n + c.products.length, 0);
  console.log(
    `\nListo: ${CATALOG.length} categorías, ${total} productos, ${COMBOS.length} combos, ${INGREDIENTES.length} ingredientes.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
