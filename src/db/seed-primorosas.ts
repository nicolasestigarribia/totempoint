/**
 * Carga la carta real de PrimoRosas: los 53 sanguches de miga numerados, los
 * especiales calientes y fríos, tartas, ensaladas, sushi, postres, budines y
 * bebidas, con sus categorías, recetas y combos.
 *
 * Todo queda en la base como cualquier catálogo cargado desde el panel: nada
 * hardcodeado en las pantallas. Las fotos se bajan de Pexels (licencia libre,
 * uso comercial sin atribución) y se guardan en la tabla `images` igual que una
 * subida del panel, así que se sirven por /img/:id y se pueden reemplazar desde
 * el admin sin tocar código.
 *
 * Dos cosas que conviene saber antes de tocar esto:
 *
 * - **Los precios no salen de la carta**: las fotos del menú no los traen. Los
 *   de acá son un piso coherente entre sí (un especial sale más que un clásico,
 *   un doblemente especial más que un especial) para que el tótem pueda vender
 *   desde el minuto cero. El dueño los corrige desde Precios, y el cambio
 *   masivo por categoría está justamente para eso.
 * - **Lo que la carta marca "(consultar)"** —el matambre y la ensalada de
 *   temporada— entra desactivado: no se puede cobrar en una pantalla algo que
 *   no tiene precio, pero tampoco se borra, así que el dueño le pone precio y
 *   lo prende.
 *
 * El número de cada sanguche va adelante del nombre ("07 · Jamón, zanahoria y
 * huevo") porque así está impreso y así lo pide el cliente en el mostrador; el
 * ticket de cocina sale con el mismo número.
 *
 * Correr con:  bun run src/db/seed-primorosas.ts [slug]
 * Por defecto usa el slug "sangucheria-primorosas".
 * Es idempotente: borra el catálogo anterior de esa empresa y lo vuelve a crear.
 * No toca la portada del tótem ni el logo, que se editan desde el panel.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  companies,
  categories,
  products,
  productIngredients,
  ingredients,
  ingredientCategories,
  locations,
  totems,
  locationPrices,
  locationProducts,
  stockLimits,
  combos,
  comboProducts,
  images,
} from "./schema";

const slug = process.argv[2] ?? "sangucheria-primorosas";

// ---------- Fotos ----------
// El ancho se pide en la URL para no guardar un archivo de 3 MB por foto.
const ANCHO = 900;
const BASE = "https://images.pexels.com/photos";

const FOTOS = {
  clasicos:
    "31742775/pexels-photo-31742775/free-photo-of-delicious-sandwich-platter-with-fresh-ingredients.jpeg",
  especiales:
    "34618698/pexels-photo-34618698/free-photo-of-assorted-sandwich-platter-with-fresh-ingredients.jpeg",
  doblemente:
    "34644324/pexels-photo-34644324/free-photo-of-gourmet-sandwich-platter-with-fresh-ingredients.jpeg",
  salmon: "17582279/pexels-photo-17582279/free-photo-of-small-salmon-and-cucumber-sandwiches.jpeg",
  calientes:
    "30350297/pexels-photo-30350297/free-photo-of-close-up-of-delicious-grilled-meat-sandwich.jpeg",
  frios:
    "29318983/pexels-photo-29318983/free-photo-of-appetizing-sandwich-tray-with-fresh-ingredients.jpeg",
  tartas:
    "33433982/pexels-photo-33433982/free-photo-of-homemade-vegetable-quiche-on-rustic-cloth.jpeg",
  ensaladas: "1211887/pexels-photo-1211887.jpeg",
  sushi:
    "37195238/pexels-photo-37195238/free-photo-of-assorted-sushi-platter-with-tempura-and-soy-sauce.jpeg",
  postres:
    "37678304/pexels-photo-37678304/free-photo-of-delicious-berry-topped-cheesecake-on-patio-table.jpeg",
  budines:
    "36673263/pexels-photo-36673263/free-photo-of-slice-of-lemon-cake-on-reflective-surface.jpeg",
  bebidas: "14373170/pexels-photo-14373170.jpeg",
  gaseosa: "7414290/pexels-photo-7414290.jpeg",
  agua: "31107435/pexels-photo-31107435/free-photo-of-elegant-table-setting-with-bottled-water.jpeg",
} as const;

type FotoKey = keyof typeof FOTOS;

/** Baja una foto una sola vez y la guarda en la base; devuelve su /img/:id. */
const cache = new Map<FotoKey, string>();
async function foto(companyId: number, key: FotoKey): Promise<string | null> {
  const guardada = cache.get(key);
  if (guardada) return guardada;

  const url = `${BASE}/${FOTOS[key]}?auto=compress&cs=tinysrgb&w=${ANCHO}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Una foto que no baja no puede frenar la carga entera.
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

// ---------- Ingredientes ----------
// `porcion` es cuánto lleva UN sanguche de miga, en la unidad del ingrediente.
// Los platos más grandes multiplican esa porción con el `factor` del producto,
// así la receta no obliga a repetir la misma cuenta noventa veces.

interface IngredienteSeed {
  name: string;
  categoria: string;
  unit: string;
  cost: string;
  porcion: string;
}

const CATEGORIAS_INGREDIENTES = [
  "Panificados",
  "Fiambres",
  "Lácteos",
  "Verdulería",
  "Conservas",
  "Pescadería",
  "Dulces",
];

const INGREDIENTES: IngredienteSeed[] = [
  {
    name: "Pan de miga blanco",
    categoria: "Panificados",
    unit: "plancha",
    cost: "2200",
    porcion: "0.08",
  },
  {
    name: "Pan de miga negro",
    categoria: "Panificados",
    unit: "plancha",
    cost: "2600",
    porcion: "0.08",
  },
  { name: "Pan alemán", categoria: "Panificados", unit: "unidad", cost: "1500", porcion: "1" },

  { name: "Jamón cocido", categoria: "Fiambres", unit: "kg", cost: "9800", porcion: "0.03" },
  { name: "Jamón crudo", categoria: "Fiambres", unit: "kg", cost: "24000", porcion: "0.02" },
  { name: "Salame milán", categoria: "Fiambres", unit: "kg", cost: "12400", porcion: "0.02" },
  { name: "Matambre", categoria: "Fiambres", unit: "kg", cost: "14000", porcion: "0.03" },
  { name: "Peceto", categoria: "Fiambres", unit: "kg", cost: "16000", porcion: "0.03" },
  { name: "Bondiola braseada", categoria: "Fiambres", unit: "kg", cost: "13500", porcion: "0.04" },
  { name: "Lomo", categoria: "Fiambres", unit: "kg", cost: "21000", porcion: "0.05" },
  { name: "Pollo desmenuzado", categoria: "Fiambres", unit: "kg", cost: "8900", porcion: "0.04" },
  { name: "Pechuga de pollo", categoria: "Fiambres", unit: "kg", cost: "9200", porcion: "0.04" },
  { name: "Hamburguesa", categoria: "Fiambres", unit: "unidad", cost: "2600", porcion: "1" },
  { name: "Milanesa de carne", categoria: "Fiambres", unit: "unidad", cost: "3200", porcion: "1" },
  { name: "Milanesa de pollo", categoria: "Fiambres", unit: "unidad", cost: "2900", porcion: "1" },

  { name: "Queso de máquina", categoria: "Lácteos", unit: "kg", cost: "11200", porcion: "0.03" },
  { name: "Queso crema", categoria: "Lácteos", unit: "kg", cost: "6800", porcion: "0.02" },
  { name: "Queso blanco", categoria: "Lácteos", unit: "kg", cost: "7200", porcion: "0.02" },
  { name: "Queso brie", categoria: "Lácteos", unit: "kg", cost: "26000", porcion: "0.02" },
  { name: "Queso azul", categoria: "Lácteos", unit: "kg", cost: "19000", porcion: "0.02" },
  { name: "Roquefort", categoria: "Lácteos", unit: "kg", cost: "18000", porcion: "0.02" },
  { name: "Parmesano", categoria: "Lácteos", unit: "kg", cost: "22000", porcion: "0.01" },
  { name: "Muzzarella", categoria: "Lácteos", unit: "kg", cost: "12500", porcion: "0.03" },
  { name: "Queso philadelphia", categoria: "Lácteos", unit: "kg", cost: "14000", porcion: "0.02" },
  { name: "Manteca", categoria: "Lácteos", unit: "kg", cost: "7400", porcion: "0.01" },

  { name: "Tomate", categoria: "Verdulería", unit: "kg", cost: "1900", porcion: "0.03" },
  { name: "Tomate cherry", categoria: "Verdulería", unit: "kg", cost: "4200", porcion: "0.02" },
  { name: "Lechuga", categoria: "Verdulería", unit: "planta", cost: "1200", porcion: "0.1" },
  { name: "Rúcula", categoria: "Verdulería", unit: "atado", cost: "1500", porcion: "0.1" },
  { name: "Mix de hojas", categoria: "Verdulería", unit: "bolsa", cost: "2600", porcion: "0.08" },
  { name: "Espinaca", categoria: "Verdulería", unit: "atado", cost: "1400", porcion: "0.08" },
  { name: "Albahaca", categoria: "Verdulería", unit: "atado", cost: "1300", porcion: "0.05" },
  { name: "Zanahoria", categoria: "Verdulería", unit: "kg", cost: "1400", porcion: "0.02" },
  { name: "Remolacha", categoria: "Verdulería", unit: "kg", cost: "1600", porcion: "0.02" },
  { name: "Champiñón", categoria: "Verdulería", unit: "kg", cost: "6800", porcion: "0.02" },
  { name: "Brócoli", categoria: "Verdulería", unit: "kg", cost: "3200", porcion: "0.03" },
  { name: "Palta", categoria: "Verdulería", unit: "unidad", cost: "2200", porcion: "0.25" },
  { name: "Naranja", categoria: "Verdulería", unit: "kg", cost: "1600", porcion: "0.05" },
  { name: "Pera", categoria: "Verdulería", unit: "kg", cost: "2800", porcion: "0.05" },
  { name: "Manzana", categoria: "Verdulería", unit: "kg", cost: "2200", porcion: "0.05" },
  {
    name: "Cebolla caramelizada",
    categoria: "Verdulería",
    unit: "kg",
    cost: "4000",
    porcion: "0.02",
  },
  { name: "Vegetales wok", categoria: "Verdulería", unit: "kg", cost: "3800", porcion: "0.04" },
  { name: "Frutos rojos", categoria: "Verdulería", unit: "kg", cost: "14000", porcion: "0.03" },
  { name: "Huevo", categoria: "Verdulería", unit: "docena", cost: "3600", porcion: "0.08" },

  { name: "Morrón asado", categoria: "Conservas", unit: "frasco", cost: "3200", porcion: "0.08" },
  { name: "Aceitunas", categoria: "Conservas", unit: "frasco", cost: "3000", porcion: "0.05" },
  { name: "Choclo", categoria: "Conservas", unit: "lata", cost: "1800", porcion: "0.1" },
  { name: "Atún en lomos", categoria: "Conservas", unit: "lata", cost: "3400", porcion: "0.25" },
  { name: "Pasta de atún", categoria: "Conservas", unit: "kg", cost: "7800", porcion: "0.03" },
  { name: "Palmito", categoria: "Conservas", unit: "lata", cost: "4100", porcion: "0.15" },
  {
    name: "Berenjena en escabeche",
    categoria: "Conservas",
    unit: "frasco",
    cost: "3500",
    porcion: "0.08",
  },
  { name: "Ananá", categoria: "Conservas", unit: "lata", cost: "3400", porcion: "0.1" },
  { name: "Tomates secos", categoria: "Conservas", unit: "kg", cost: "15000", porcion: "0.01" },
  {
    name: "Aceite de oliva",
    categoria: "Conservas",
    unit: "litro",
    cost: "12000",
    porcion: "0.01",
  },
  { name: "Orégano", categoria: "Conservas", unit: "kg", cost: "12000", porcion: "0.01" },
  { name: "Mayonesa", categoria: "Conservas", unit: "kg", cost: "4200", porcion: "0.02" },
  { name: "Salsa golf", categoria: "Conservas", unit: "kg", cost: "4400", porcion: "0.02" },
  { name: "Salsa césar", categoria: "Conservas", unit: "kg", cost: "6500", porcion: "0.02" },
  { name: "Aderezo light", categoria: "Conservas", unit: "kg", cost: "5200", porcion: "0.02" },
  { name: "Vinagreta de miel", categoria: "Conservas", unit: "kg", cost: "7000", porcion: "0.02" },
  { name: "Croutons", categoria: "Conservas", unit: "kg", cost: "5200", porcion: "0.02" },
  { name: "Semillas", categoria: "Conservas", unit: "kg", cost: "9000", porcion: "0.01" },
  { name: "Nueces", categoria: "Conservas", unit: "kg", cost: "28000", porcion: "0.01" },
  { name: "Almendras", categoria: "Conservas", unit: "kg", cost: "26000", porcion: "0.01" },

  { name: "Salmón ahumado", categoria: "Pescadería", unit: "kg", cost: "42000", porcion: "0.02" },
  { name: "Kanikama", categoria: "Pescadería", unit: "kg", cost: "7600", porcion: "0.02" },
  { name: "Langostino", categoria: "Pescadería", unit: "kg", cost: "18000", porcion: "0.02" },

  {
    name: "Dulce de leche repostero",
    categoria: "Dulces",
    unit: "kg",
    cost: "6200",
    porcion: "0.03",
  },
  { name: "Chocolate cobertura", categoria: "Dulces", unit: "kg", cost: "15000", porcion: "0.02" },
  { name: "Maracuyá", categoria: "Dulces", unit: "kg", cost: "9000", porcion: "0.02" },
  { name: "Limón", categoria: "Dulces", unit: "kg", cost: "1800", porcion: "0.02" },
  { name: "Miel", categoria: "Dulces", unit: "kg", cost: "9500", porcion: "0.01" },
];

// ---------- La carta ----------

interface ProductoSeed {
  name: string;
  description?: string;
  price: string;
  /** Ingredientes de la receta. El pan de miga lo agrega la categoría. */
  lleva?: string[];
  /** Multiplica la porción de cada ingrediente (un plato no es un sanguchito). */
  factor?: number;
  foto?: FotoKey;
  /** Lo que la carta marca "(consultar)" entra apagado, sin precio real. */
  activo?: boolean;
  /** Reventa: se compra hecho y tiene stock propio. */
  reventa?: boolean;
}

interface CategoriaSeed {
  name: string;
  tagline: string;
  foto: FotoKey;
  /** Pan que lleva todo lo de esta categoría, si lleva. */
  pan?: string;
  productos: ProductoSeed[];
}

/** Un sanguche de miga de la lista numerada. */
interface MigaSeed {
  n: number;
  name: string;
  lleva: string[];
  description?: string;
}

const miga = (n: number, name: string, lleva: string[], description?: string): MigaSeed => ({
  n,
  name,
  lleva,
  description,
});

/** Los numera igual que la carta impresa y les pone el precio de su línea. */
const numerados = (items: MigaSeed[], price: string): ProductoSeed[] =>
  items.map((s) => ({
    name: `${String(s.n).padStart(2, "0")} · ${s.name}`,
    description: s.description,
    price,
    lleva: s.lleva,
    activo: s.description?.includes("consultar") ? false : undefined,
  }));

const CARTA: CategoriaSeed[] = [
  {
    name: "Clásicos",
    tagline: "Sanguches de miga, del 01 al 18",
    foto: "clasicos",
    pan: "Pan de miga blanco",
    productos: numerados(
      [
        miga(1, "Jamón y queso", ["Jamón cocido", "Queso de máquina", "Manteca"]),
        miga(2, "Jamón y aceitunas", ["Jamón cocido", "Aceitunas", "Manteca"]),
        miga(3, "Jamón y tomate", ["Jamón cocido", "Tomate"]),
        miga(4, "Jamón y huevo", ["Jamón cocido", "Huevo", "Mayonesa"]),
        miga(5, "Jamón, tomate, orégano y oliva", [
          "Jamón cocido",
          "Tomate",
          "Orégano",
          "Aceite de oliva",
        ]),
        miga(6, "Jamón, tomate y huevo", ["Jamón cocido", "Tomate", "Huevo"]),
        miga(7, "Jamón, zanahoria y huevo", ["Jamón cocido", "Zanahoria", "Huevo", "Mayonesa"]),
        miga(8, "Jamón, choclo y huevo", ["Jamón cocido", "Choclo", "Huevo", "Mayonesa"]),
        miga(9, "Queso y tomate", ["Queso de máquina", "Tomate"]),
        miga(10, "Queso, tomate y albahaca", ["Queso de máquina", "Tomate", "Albahaca"]),
        miga(11, "Queso, zanahoria y huevo", [
          "Queso de máquina",
          "Zanahoria",
          "Huevo",
          "Mayonesa",
        ]),
        miga(12, "Queso, remolacha y huevo", [
          "Queso de máquina",
          "Remolacha",
          "Huevo",
          "Mayonesa",
        ]),
        miga(13, "Queso, choclo y huevo", ["Queso de máquina", "Choclo", "Huevo", "Mayonesa"]),
        miga(14, "Queso y queso", ["Queso de máquina", "Queso crema"]),
        miga(15, "Queso, aceitunas y huevo", ["Queso de máquina", "Aceitunas", "Huevo"]),
        miga(16, "Queso, mix de hojas y huevo c/semillas", [
          "Queso de máquina",
          "Mix de hojas",
          "Huevo",
          "Semillas",
        ]),
        miga(17, "Tomate, rúcula, remolacha y zanahoria", [
          "Tomate",
          "Rúcula",
          "Remolacha",
          "Zanahoria",
        ]),
        miga(18, "Salame y queso", ["Salame milán", "Queso de máquina", "Manteca"]),
      ],
      "1400",
    ),
  },
  {
    name: "Especiales",
    tagline: "Sanguches de miga, del 19 al 38",
    foto: "especiales",
    pan: "Pan de miga blanco",
    productos: numerados(
      [
        miga(19, "Jamón, rúcula y cherry", ["Jamón cocido", "Rúcula", "Tomate cherry"]),
        miga(20, "Jamón, champiñón y parmesano", ["Jamón cocido", "Champiñón", "Parmesano"]),
        miga(21, "Jamón, palmitos y salsa golf", ["Jamón cocido", "Palmito", "Salsa golf"]),
        miga(22, "Jamón y ananá", ["Jamón cocido", "Ananá"]),
        miga(23, "Jamón y roquefort", ["Jamón cocido", "Roquefort"]),
        miga(24, "Jamón, morrón y huevo", ["Jamón cocido", "Morrón asado", "Huevo"]),
        miga(25, "Queso, rúcula y tomate", ["Queso de máquina", "Rúcula", "Tomate"]),
        miga(26, "Queso, atún en lomos y huevo", ["Queso de máquina", "Atún en lomos", "Huevo"]),
        miga(27, "Queso, tomate, palmitos y salsa golf", [
          "Queso de máquina",
          "Tomate",
          "Palmito",
          "Salsa golf",
        ]),
        miga(28, "Queso, brócoli y huevo", ["Queso de máquina", "Brócoli", "Huevo"]),
        miga(29, "Jamón crudo y queso", ["Jamón crudo", "Queso de máquina"]),
        miga(30, "Jamón crudo y tomate", ["Jamón crudo", "Tomate"]),
        miga(31, "Jamón crudo, rúcula y parmesano", ["Jamón crudo", "Rúcula", "Parmesano"]),
        miga(32, "Jamón crudo, rúcula y tomate", ["Jamón crudo", "Rúcula", "Tomate"]),
        miga(33, "Matambre y queso", ["Matambre", "Queso de máquina"], "Precio a consultar."),
        miga(34, "Atún en lomos, huevo y zanahoria", ["Atún en lomos", "Huevo", "Zanahoria"]),
        miga(35, "Champiñón, parmesano y tomate", ["Champiñón", "Parmesano", "Tomate"]),
        miga(36, "Jamón, queso, tomate y lechuga", [
          "Jamón cocido",
          "Queso de máquina",
          "Tomate",
          "Lechuga",
        ]),
        miga(37, "Naranja, rúcula y parmesano", ["Naranja", "Rúcula", "Parmesano"]),
        miga(38, "Queso y berenjenas", ["Queso de máquina", "Berenjena en escabeche"]),
      ],
      "1700",
    ),
  },
  {
    name: "Doblemente especiales",
    tagline: "Sanguches de miga, del 39 al 50",
    foto: "doblemente",
    pan: "Pan de miga negro",
    productos: numerados(
      [
        miga(39, "Crudo y ananá", ["Jamón crudo", "Ananá"]),
        miga(40, "Roquefort, pera, espinaca y almendras", [
          "Roquefort",
          "Pera",
          "Espinaca",
          "Almendras",
        ]),
        miga(41, "Tomates secos, rúcula y parmesano", ["Tomates secos", "Rúcula", "Parmesano"]),
        miga(42, "Tomates secos, mix de hojas, aceite y muzzarella", [
          "Tomates secos",
          "Mix de hojas",
          "Aceite de oliva",
          "Muzzarella",
        ]),
        miga(43, "Tomate, rúcula, palta y palmitos", ["Tomate", "Rúcula", "Palta", "Palmito"]),
        miga(44, "Wok, palta y tomate", ["Vegetales wok", "Palta", "Tomate"]),
        miga(45, "Pollo, rúcula y parmesano", ["Pollo desmenuzado", "Rúcula", "Parmesano"]),
        miga(46, "Pollo, queso y rúcula", ["Pollo desmenuzado", "Queso de máquina", "Rúcula"]),
        miga(47, "Pollo, zanahoria y tomate", ["Pollo desmenuzado", "Zanahoria", "Tomate"]),
        miga(
          48,
          "Pollo caesar",
          ["Pollo desmenuzado", "Lechuga", "Tomate cherry", "Aceitunas", "Salsa césar"],
          "Pollo, lechuga, cherry, aceitunas y salsa césar.",
        ),
        miga(49, "Pollo, tomate, huevo y queso", [
          "Pollo desmenuzado",
          "Tomate",
          "Huevo",
          "Queso de máquina",
        ]),
        miga(50, "Pollo y wok", ["Pollo desmenuzado", "Vegetales wok"]),
      ],
      "2000",
    ),
  },
  {
    name: "Salmón y de autor",
    tagline: "Los tres que cierran la carta",
    foto: "salmon",
    pan: "Pan de miga blanco",
    productos: [
      {
        name: "51 · Salmón, queso blanco y rúcula",
        price: "2800",
        lleva: ["Salmón ahumado", "Queso blanco", "Rúcula"],
      },
      {
        name: "52 · Salmón, queso blanco, palta y cherry",
        price: "2900",
        lleva: ["Salmón ahumado", "Queso blanco", "Palta", "Tomate cherry"],
      },
      {
        name: "53 · PrimoRosas",
        description: "Frutos rojos, queso brie, mix de hojas, semillas y vinagreta en miel.",
        price: "2700",
        lleva: ["Frutos rojos", "Queso brie", "Mix de hojas", "Semillas", "Vinagreta de miel"],
      },
    ],
  },
  {
    name: "Especiales calientes",
    tagline: "Para comer con las dos manos",
    foto: "calientes",
    productos: [
      {
        name: "De lomo completo",
        description: "Lechuga, tomate, queso, jamón y huevo.",
        price: "12500",
        factor: 2,
        lleva: ["Lomo", "Lechuga", "Tomate", "Queso de máquina", "Jamón cocido", "Huevo"],
      },
      {
        name: "De bondiola braseada completo",
        description: "Lechuga, tomate, queso, jamón y huevo.",
        price: "11500",
        factor: 2,
        lleva: [
          "Bondiola braseada",
          "Lechuga",
          "Tomate",
          "Queso de máquina",
          "Jamón cocido",
          "Huevo",
        ],
      },
      {
        name: "De hamburguesa",
        price: "9500",
        factor: 2,
        lleva: ["Hamburguesa", "Queso de máquina", "Lechuga", "Tomate"],
      },
      {
        name: "De milanesa de carne",
        price: "10500",
        factor: 2,
        lleva: ["Milanesa de carne", "Lechuga", "Tomate"],
      },
      {
        name: "De milanesa de pollo",
        price: "9900",
        factor: 2,
        lleva: ["Milanesa de pollo", "Lechuga", "Tomate"],
      },
    ],
  },
  {
    name: "Especiales fríos",
    tagline: "Los de nombre propio",
    foto: "frios",
    productos: [
      {
        name: "Mónaco",
        description: "Salsa golf, pollo, cebolla caramelizada y ananá.",
        price: "9500",
        factor: 2.5,
        lleva: ["Salsa golf", "Pechuga de pollo", "Cebolla caramelizada", "Ananá"],
      },
      {
        name: "V.I.P.",
        description: "Manteca, jamón crudo, nueces, queso azul y tomates secos.",
        price: "10500",
        factor: 2.5,
        lleva: ["Manteca", "Jamón crudo", "Nueces", "Queso azul", "Tomates secos"],
      },
      {
        name: "Pampeano",
        description: "Pan alemán, salsa golf, peceto, muzzarella y tomate.",
        price: "9500",
        factor: 2.5,
        lleva: ["Pan alemán", "Salsa golf", "Peceto", "Muzzarella", "Tomate"],
      },
      {
        name: "Granjero",
        description: "Mayonesa, pechuga, muzzarella, morrón y oliva.",
        price: "9500",
        factor: 2.5,
        lleva: ["Mayonesa", "Pechuga de pollo", "Muzzarella", "Morrón asado", "Aceitunas"],
      },
      {
        name: "Marino",
        description: "Salsa golf, pasta de atún, morrón y oliva.",
        price: "9500",
        factor: 2.5,
        lleva: ["Salsa golf", "Pasta de atún", "Morrón asado", "Aceitunas"],
      },
      {
        name: "Capresse",
        description: "Muzzarella, tomate y aceitunas.",
        price: "8900",
        factor: 2.5,
        lleva: ["Muzzarella", "Tomate", "Aceitunas"],
      },
      {
        name: "Veggie",
        description: "Lechuga, espinaca, rúcula, champiñón, cherry y aderezo light.",
        price: "8900",
        factor: 2.5,
        lleva: ["Lechuga", "Espinaca", "Rúcula", "Champiñón", "Tomate cherry", "Aderezo light"],
      },
    ],
  },
  {
    name: "Tartas",
    tagline: "Porción, recién horneada",
    foto: "tartas",
    productos: [
      {
        name: "Tarta de jamón y queso",
        price: "5500",
        factor: 2,
        lleva: ["Jamón cocido", "Queso de máquina", "Huevo"],
      },
      {
        name: "Tarta de vegetales con queso",
        price: "5500",
        factor: 2,
        lleva: ["Espinaca", "Zanahoria", "Queso de máquina", "Huevo"],
      },
      {
        name: "Tarta capresse",
        price: "5500",
        factor: 2,
        lleva: ["Muzzarella", "Tomate", "Albahaca"],
      },
    ],
  },
  {
    name: "Ensaladas",
    tagline: "Armadas en el momento",
    foto: "ensaladas",
    productos: [
      {
        name: "Trendy",
        description: "Rúcula, hojas verdes, tomates secos, parmesano y aceitunas.",
        price: "8500",
        factor: 3,
        lleva: ["Rúcula", "Mix de hojas", "Tomates secos", "Parmesano", "Aceitunas"],
      },
      {
        name: "Caesar",
        description: "Lechuga, pollo, parmesano, salsa caesar y croutons.",
        price: "9500",
        factor: 3,
        lleva: ["Lechuga", "Pollo desmenuzado", "Parmesano", "Salsa césar", "Croutons"],
      },
      {
        name: "Cheff",
        description: "Hojas verdes, jamón, queso, huevo, zanahoria y tomates cherry.",
        price: "9500",
        factor: 3,
        lleva: [
          "Mix de hojas",
          "Jamón cocido",
          "Queso de máquina",
          "Huevo",
          "Zanahoria",
          "Tomate cherry",
        ],
      },
      {
        name: "De champis",
        description: "Lechuga, champiñones, queso parmesano y tomates cherry.",
        price: "8500",
        factor: 3,
        lleva: ["Lechuga", "Champiñón", "Parmesano", "Tomate cherry"],
      },
      {
        name: "De temporada",
        description: "Cambia según lo que haya. Precio a consultar.",
        price: "0",
        activo: false,
      },
    ],
  },
  {
    name: "Sushi rolls",
    tagline: "Bandeja surtida para compartir",
    foto: "sushi",
    productos: [
      {
        name: "Bandeja x 15 surtida",
        description:
          "3 unidades de cada sabor: salmón con philadelphia y palta; langostino con philadelphia; kanikama con philadelphia; atún, ciboulette y philadelphia; tomates secos, rúcula y philadelphia.",
        price: "24000",
        factor: 6,
        lleva: [
          "Salmón ahumado",
          "Langostino",
          "Kanikama",
          "Atún en lomos",
          "Queso philadelphia",
          "Palta",
          "Tomates secos",
          "Rúcula",
        ],
      },
    ],
  },
  {
    name: "Postres caseros",
    tagline: "Hechos acá, todos los días",
    foto: "postres",
    productos: [
      {
        name: "Mousse de chocolate",
        price: "4500",
        factor: 3,
        lleva: ["Chocolate cobertura", "Huevo"],
      },
      {
        name: "Cheese cake de frutos rojos",
        price: "5500",
        factor: 3,
        lleva: ["Queso crema", "Frutos rojos"],
      },
      {
        name: "Cheese cake de maracuyá",
        price: "5500",
        factor: 3,
        lleva: ["Queso crema", "Maracuyá"],
      },
      {
        name: "Tiramisú",
        price: "5500",
        factor: 3,
        lleva: ["Queso crema", "Chocolate cobertura"],
      },
      {
        name: "Primorosas",
        description: "Dulce de leche, merenguitos, crema chantilly y frutos del bosque.",
        price: "5900",
        factor: 3,
        lleva: ["Dulce de leche repostero", "Frutos rojos", "Huevo"],
      },
      {
        name: "Ensalada de frutas",
        price: "4200",
        factor: 3,
        lleva: ["Naranja", "Manzana", "Pera"],
      },
    ],
  },
  {
    name: "Budines",
    tagline: "Por porción, para el café",
    foto: "budines",
    productos: [
      {
        name: "Budín de chocolate",
        price: "3200",
        factor: 2,
        lleva: ["Chocolate cobertura", "Huevo"],
      },
      { name: "Budín de manzana", price: "3200", factor: 2, lleva: ["Manzana", "Huevo"] },
      { name: "Budín de limón", price: "3200", factor: 2, lleva: ["Limón", "Huevo"] },
    ],
  },
  {
    name: "Bebidas",
    tagline: "Frías, de la heladera",
    foto: "bebidas",
    productos: [
      { name: "Lata de gaseosa", price: "2500", reventa: true, foto: "gaseosa" },
      { name: "Gaseosa 600 cm³", price: "3200", reventa: true, foto: "gaseosa" },
      { name: "Gaseosa 1,5 l", price: "4800", reventa: true, foto: "gaseosa" },
      { name: "Agua 500 cm³", price: "2500", reventa: true, foto: "agua" },
      { name: "Agua 1,5 l", price: "3500", reventa: true, foto: "agua" },
      { name: "Aquarius 500 cm³", price: "3000", reventa: true, foto: "agua" },
      { name: "Aquarius 1,5 l", price: "4800", reventa: true, foto: "agua" },
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

// Los de miga se venden por docena en el mostrador; el tótem tiene que poder
// hacer lo mismo sin obligar al cliente a tocar doce veces.
const COMBOS: ComboSeed[] = [
  {
    name: "Media docena de clásicos",
    description: "Seis sanguchitos surtidos de la línea clásica.",
    price: "7600",
    foto: "clasicos",
    items: [
      { producto: "01 · Jamón y queso", cantidad: 2 },
      { producto: "03 · Jamón y tomate", cantidad: 1 },
      { producto: "09 · Queso y tomate", cantidad: 1 },
      { producto: "14 · Queso y queso", cantidad: 1 },
      { producto: "18 · Salame y queso", cantidad: 1 },
    ],
  },
  {
    name: "Docena de clásicos",
    description: "Doce sanguchitos surtidos de la línea clásica.",
    price: "14500",
    foto: "especiales",
    items: [
      { producto: "01 · Jamón y queso", cantidad: 3 },
      { producto: "03 · Jamón y tomate", cantidad: 2 },
      { producto: "04 · Jamón y huevo", cantidad: 2 },
      { producto: "09 · Queso y tomate", cantidad: 2 },
      { producto: "14 · Queso y queso", cantidad: 2 },
      { producto: "18 · Salame y queso", cantidad: 1 },
    ],
  },
  {
    name: "Almuerzo al paso",
    description: "Tres clásicos y una lata bien fría.",
    price: "6400",
    foto: "doblemente",
    items: [
      { producto: "01 · Jamón y queso", cantidad: 1 },
      { producto: "09 · Queso y tomate", cantidad: 1 },
      { producto: "18 · Salame y queso", cantidad: 1 },
      { producto: "Lata de gaseosa", cantidad: 1 },
    ],
  },
];

// ---------- Carga ----------

async function main() {
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!company) throw new Error(`No existe ninguna empresa con el slug "${slug}"`);
  const companyId = company.id;
  console.log(`Cargando la carta en ${company.name} (id ${companyId})\n`);

  // Borra el catálogo anterior. Todo lo que cuelga de un producto se va con él:
  // si quedaran filas sueltas apuntando a ids borrados, el panel mostraría
  // precios por negocio y límites de stock de productos que ya no existen.
  // La auditoría de precios (`price_changes`) no se toca: es un registro de lo
  // que alguien hizo, y borrarlo porque el producto ya no está sería justo lo
  // contrario de para qué existe.
  const viejosProductos = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.companyId, companyId));
  if (viejosProductos.length > 0) {
    const ids = viejosProductos.map((p) => p.id);
    await db.delete(productIngredients).where(inArray(productIngredients.productId, ids));
    await db.delete(locationProducts).where(inArray(locationProducts.productId, ids));
    await db.delete(stockLimits).where(inArray(stockLimits.productId, ids));
    await db
      .delete(locationPrices)
      .where(and(eq(locationPrices.itemType, "product"), inArray(locationPrices.itemId, ids)));
  }
  const viejosCombos = await db
    .select({ id: combos.id })
    .from(combos)
    .where(eq(combos.companyId, companyId));
  if (viejosCombos.length > 0) {
    const ids = viejosCombos.map((c) => c.id);
    await db.delete(comboProducts).where(inArray(comboProducts.comboId, ids));
    await db
      .delete(locationPrices)
      .where(and(eq(locationPrices.itemType, "combo"), inArray(locationPrices.itemId, ids)));
  }
  await db.delete(combos).where(eq(combos.companyId, companyId));
  await db.delete(products).where(eq(products.companyId, companyId));
  await db.delete(categories).where(eq(categories.companyId, companyId));
  await db.delete(ingredients).where(eq(ingredients.companyId, companyId));
  await db.delete(ingredientCategories).where(eq(ingredientCategories.companyId, companyId));
  console.log("Catálogo anterior borrado.");

  // Ingredientes, con su rubro.
  const catIngredienteId = new Map<string, number>();
  for (const nombre of CATEGORIAS_INGREDIENTES) {
    const [{ id }] = await db
      .insert(ingredientCategories)
      .values({ companyId, name: nombre, active: true })
      .$returningId();
    catIngredienteId.set(nombre, id);
  }

  const ingredienteId = new Map<string, number>();
  const porcionDe = new Map<string, number>();
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
    porcionDe.set(ing.name, Number(ing.porcion));
  }
  console.log(`${INGREDIENTES.length} ingredientes en ${CATEGORIAS_INGREDIENTES.length} rubros.`);

  // Categorías y productos.
  const idPorNombre = new Map<string, number>();
  let totalProductos = 0;
  let apagados = 0;

  for (const [i, cat] of CARTA.entries()) {
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

    for (const [j, p] of cat.productos.entries()) {
      const activo = p.activo ?? true;
      // Sin foto propia va la de su categoría: son dieciocho sanguches de miga
      // que se ven igual, y una foto por variante sería la misma foto repetida
      // o, peor, una que no es de ese sanguche.
      const suFoto = p.foto ? await foto(companyId, p.foto) : photoUrl;
      const [{ id: productId }] = await db
        .insert(products)
        .values({
          companyId,
          categoryId,
          name: p.name,
          description: p.description ?? null,
          price: p.price,
          photoUrl: suFoto,
          stockable: p.reventa ?? false,
          unit: p.reventa ? "unidad" : null,
          active: activo,
          sort: j,
        })
        .$returningId();
      idPorNombre.set(p.name, productId);
      totalProductos++;
      if (!activo) apagados++;

      // Receta: el pan de la categoría más lo que diga el producto.
      const factor = p.factor ?? 1;
      const receta = [...(cat.pan ? [cat.pan] : []), ...(p.lleva ?? [])];
      for (const nombre of receta) {
        const ingredientId = ingredienteId.get(nombre);
        if (!ingredientId)
          throw new Error(`"${p.name}" lleva "${nombre}", que no es un ingrediente`);
        const cantidad = (porcionDe.get(nombre) ?? 0) * factor;
        await db
          .insert(productIngredients)
          .values({ productId, ingredientId, quantity: cantidad.toFixed(2) });
      }
    }
    console.log(`Categoría "${cat.name}": ${cat.productos.length} productos.`);
  }

  // Combos.
  for (const [i, c] of COMBOS.entries()) {
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
        sort: i,
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

  console.log(
    `\nListo: ${totalProductos} productos en ${CARTA.length} categorías` +
      (apagados > 0 ? ` (${apagados} apagados, los que la carta marca "consultar").` : "."),
  );
  // La URL del tótem lleva empresa, local y número, así que se arma con el
  // primer tótem que tenga la empresa. Si todavía no hay ninguno, el catálogo
  // quedó cargado igual y el tótem se crea desde el panel.
  const [puesto] = await db
    .select({ local: locations.slug, numero: totems.number })
    .from(totems)
    .innerJoin(locations, eq(locations.id, totems.locationId))
    .where(and(eq(locations.companyId, companyId), eq(totems.active, true)))
    .orderBy(locations.id, totems.number)
    .limit(1);
  console.log(
    puesto
      ? `El tótem queda en /t/${slug}/${puesto.local}/${puesto.numero}`
      : `Falta crear un tótem para esta empresa desde el panel (sección Tótems).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
