import { sql } from "drizzle-orm";
import { PANEL_SECTIONS } from "@/lib/auth/permissions";
import {
  mysqlTable,
  varchar,
  boolean,
  timestamp,
  int,
  decimal,
  mysqlEnum,
  text,
  mediumtext,
  unique,
  index,
} from "drizzle-orm/mysql-core";

// Empresas (cliente que compra el sistema / tenant)
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 500 }),
  primaryColor: varchar("primary_color", { length: 9 }).default("#000000"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Locales (sucursales de una empresa)
export const locations = mysqlTable(
  "locations",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    address: varchar("address", { length: 255 }),
    phone: varchar("phone", { length: 40 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("locations_company_idx").on(t.companyId)],
);

// Usuarios propios. superadmin: companyId/locationId null; owner/encargado: ligados
// a una empresa. locationId queda como local por defecto (legacy): el alcance real
// de un encargado son las filas de user_locations.
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 60 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    companyId: int("company_id"),
    locationId: int("location_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("users_company_idx").on(t.companyId), index("users_location_idx").on(t.locationId)],
);

// Sesiones (cookie httpOnly). id = token secreto aleatorio, NO autoincrement.
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    // Última vez que se usó la sesión: sirve para cerrarla por inactividad,
    // que es lo único que limita una tablet que quedó logueada.
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Intentos fallidos de login, para frenar a quien prueba contraseñas de a miles.
// Se cuenta por usuario/email: una racha de fallos bloquea ese identificador
// unos minutos. Un acierto borra la fila.
export const loginAttempts = mysqlTable("login_attempts", {
  identifier: varchar("identifier", { length: 255 }).primaryKey(),
  failedCount: int("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Roles (un usuario puede tener varios).
// superadmin: equipo de desarrollo, ve todo el sistema y da de alta empresas.
// owner: dueno de una empresa, ve todos los locales de su empresa.
// encargado: lo da de alta el owner, solo ve los locales que tiene asignados
// en user_locations.
// kitchen: pantalla de comandas; se mantiene del modelo anterior.
export const userRoles = mysqlTable(
  "user_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    role: mysqlEnum("role", ["superadmin", "owner", "encargado", "kitchen"]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("user_roles_user_role_uq").on(t.userId, t.role)],
);

// Locales asignados a un usuario (un encargado puede estar a cargo de 1 a N locales).
// El owner no necesita filas aca: ve todos los locales de su empresa.
export const userLocations = mysqlTable(
  "user_locations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    locationId: int("location_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("user_locations_user_location_uq").on(t.userId, t.locationId),
    index("user_locations_location_idx").on(t.locationId),
  ],
);

export { PANEL_SECTIONS };

// Permisos que el dueño le da a cada operador, sección por sección.
// Sin fila = no ve la sección. "ver" = solo lectura, "editar" = puede modificar.
// El dueño y el superadmin no llevan filas acá: pueden todo.
// Resumen, Negocios y Operadores no se delegan: son del dueño.
export const userPermissions = mysqlTable(
  "user_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    section: mysqlEnum("section", PANEL_SECTIONS).notNull(),
    level: mysqlEnum("level", ["ver", "editar"]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("user_permissions_user_section_uq").on(t.userId, t.section)],
);

// Imágenes subidas por cada negocio, guardadas como base64 en la propia base
// para no depender de un storage externo. El navegador las comprime antes de
// subirlas; se sirven por /img/:id desde src/lib/images.ts.
export const images = mysqlTable(
  "images",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    mimeType: varchar("mime_type", { length: 40 }).notNull(),
    data: mediumtext("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("images_company_idx").on(t.companyId)],
);

// Portada del tótem, una fila por empresa. Reemplaza lo que antes estaba
// hardcodeado en la home: cada rubro (hamburguesería, discoteca, sanguchería)
// carga su propia imagen, textos y plantilla desde el panel admin.
export const totemSettings = mysqlTable(
  "totem_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    template: mysqlEnum("template", ["clasico", "completo", "split"]).notNull().default("clasico"),
    // Base de color de las pantallas de adentro del tótem. El color de acento
    // las tiñe encima, así el menú sigue la marca y no queda un negro plano.
    theme: mysqlEnum("theme", ["oscuro", "claro", "calido"]).notNull().default("oscuro"),
    heroImageUrl: varchar("hero_image_url", { length: 500 }),
    eyebrow: varchar("eyebrow", { length: 60 }),
    title: varchar("title", { length: 60 }),
    titleAccent: varchar("title_accent", { length: 60 }),
    subtitle: varchar("subtitle", { length: 255 }),
    ctaLabel: varchar("cta_label", { length: 40 }).notNull().default("Empezar pedido"),
    badge1: varchar("badge_1", { length: 40 }),
    badge2: varchar("badge_2", { length: 40 }),
    accentColor: varchar("accent_color", { length: 9 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [unique("totem_settings_company_uq").on(t.companyId)],
);

// Categorías del menú (a nivel empresa)
export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    tagline: varchar("tagline", { length: 60 }),
    photoUrl: varchar("photo_url", { length: 500 }),
    sort: int("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("categories_company_idx").on(t.companyId)],
);

// Productos (a nivel empresa)
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    categoryId: int("category_id"),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    photoUrl: varchar("photo_url", { length: 500 }),
    // stockable = producto de reventa con stock propio (ej: bebidas). Se descuenta al vender.
    // No stockable = preparado; su stock deriva de los ingredientes de la receta.
    stockable: boolean("stockable").notNull().default(false),
    // Unidad y unidades por bulto: sólo aplican a productos stockable (reventa).
    unit: varchar("unit", { length: 20 }),
    unitsPerBulk: decimal("units_per_bulk", { precision: 10, scale: 2 }).notNull().default("1"),
    active: boolean("active").notNull().default(true),
    sort: int("sort").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("products_company_idx").on(t.companyId)],
);

// Categorías de ingredientes. companyId null = global; seteado = privado de la empresa.
export const ingredientCategories = mysqlTable(
  "ingredient_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ingredient_categories_company_idx").on(t.companyId)],
);

// Ingredientes. companyId null = global (gestiona superadmin); seteado = privado de la empresa.
export const ingredients = mysqlTable(
  "ingredients",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    categoryId: int("category_id"),
    name: varchar("name", { length: 120 }).notNull(),
    unit: varchar("unit", { length: 20 }),
    // Unidades base por bulto/caja (ej: 1 caja de coca = 6). 1 = no viene en bulto.
    unitsPerBulk: decimal("units_per_bulk", { precision: 10, scale: 2 }).notNull().default("1"),
    // Costo de compra unitario. Sirve para costear recetas. No tiene precio de venta (no se vende solo).
    cost: decimal("cost", { precision: 10, scale: 2 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ingredients_company_idx").on(t.companyId)],
);

// Ingredientes de un producto (M:N). quantity = cantidad usada por este producto.
export const productIngredients = mysqlTable(
  "product_ingredients",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull(),
    ingredientId: int("ingredient_id").notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }),
  },
  (t) => [
    unique("product_ingredients_uq").on(t.productId, t.ingredientId),
    index("product_ingredients_product_idx").on(t.productId),
  ],
);

// Disponibilidad de producto por local (override). Ausencia = disponible si product.active.
export const locationProducts = mysqlTable(
  "location_products",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("location_id").notNull(),
    productId: int("product_id").notNull(),
    available: boolean("available").notNull().default(true),
  },
  (t) => [
    unique("location_products_uq").on(t.locationId, t.productId),
    index("location_products_location_idx").on(t.locationId),
  ],
);

// Disponibilidad de categoría por local (override).
export const locationCategories = mysqlTable(
  "location_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("location_id").notNull(),
    categoryId: int("category_id").notNull(),
    available: boolean("available").notNull().default(true),
  },
  (t) => [
    unique("location_categories_uq").on(t.locationId, t.categoryId),
    index("location_categories_location_idx").on(t.locationId),
  ],
);

// Precio por local de un producto o combo (override). Ausencia = usa el precio base.
export const locationPrices = mysqlTable(
  "location_prices",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("location_id").notNull(),
    itemType: mysqlEnum("item_type", ["product", "combo"]).notNull(),
    itemId: int("item_id").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    unique("location_prices_uq").on(t.locationId, t.itemType, t.itemId),
    index("location_prices_location_idx").on(t.locationId),
  ],
);

// Auditoría de cambios de precio por local. oldPrice null = no había override (venía del base).
export const priceChanges = mysqlTable(
  "price_changes",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    locationId: int("location_id").notNull(),
    itemType: mysqlEnum("item_type", ["product", "combo"]).notNull(),
    itemId: int("item_id").notNull(),
    oldPrice: decimal("old_price", { precision: 10, scale: 2 }),
    newPrice: decimal("new_price", { precision: 10, scale: 2 }).notNull(),
    userId: int("user_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("price_changes_company_idx").on(t.companyId),
    index("price_changes_location_idx").on(t.locationId),
    index("price_changes_item_idx").on(t.itemType, t.itemId),
  ],
);

// Stock por local de un ítem stockable: ingrediente O producto de reventa (exactamente uno).
// stockActual = columna generada: ingresos - ventas - egresos.
export const artistock = mysqlTable(
  "artistock",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    ingredientId: int("ingredient_id"), // null si el stock es de un producto de reventa
    productId: int("product_id"), // null si el stock es de un ingrediente
    locationId: int("location_id").notNull(),
    ipLocal: decimal("ip_local", { precision: 10, scale: 2 }).notNull().default("0"),
    vpLocal: decimal("vp_local", { precision: 10, scale: 2 }).notNull().default("0"),
    epLocal: decimal("ep_local", { precision: 10, scale: 2 }).notNull().default("0"),
    stockActual: decimal("stock_actual", { precision: 10, scale: 2 }).generatedAlwaysAs(
      sql`ip_local - vp_local - ep_local`,
      { mode: "virtual" },
    ),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    unique("artistock_location_ingredient_uq").on(t.locationId, t.ingredientId),
    unique("artistock_location_product_uq").on(t.locationId, t.productId),
    index("artistock_location_idx").on(t.locationId),
    index("artistock_ingredient_idx").on(t.ingredientId),
    index("artistock_product_idx").on(t.productId),
    index("artistock_company_idx").on(t.companyId),
  ],
);

// Catálogo de códigos de acción para movements. companyId null = global/sistema.
export const actionCodes = mysqlTable(
  "action_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    type: mysqlEnum("type", ["stock", "caja"]).notNull(),
    direction: mysqlEnum("direction", ["ingreso", "egreso"]).notNull(),
    auto: boolean("auto").notNull().default(false), // generado por el sistema (no cargable a mano)
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("action_codes_company_idx").on(t.companyId),
    unique("action_codes_company_code_uq").on(t.companyId, t.code),
  ],
);

// Movements: libro mayor transversal. type = dominio (stock o caja).
// actionCode = motivo (ING_COMPRA, EGR_VENCIMIENTO, VENTA, ...).
// amount ya viene firmado (+ ingreso, − egreso). Desde acá se derivan stock y caja.
export const movements = mysqlTable(
  "movements",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    locationId: int("location_id").notNull(),
    ingredientId: int("ingredient_id"), // null para caja o para stock de producto de reventa
    productId: int("product_id"), // seteado para stock de producto de reventa
    type: mysqlEnum("type", ["stock", "caja"]).notNull().default("stock"),
    actionCode: varchar("action_code", { length: 40 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    detail: varchar("detail", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("movements_company_idx").on(t.companyId),
    index("movements_location_idx").on(t.locationId),
    index("movements_ingredient_idx").on(t.ingredientId),
    index("movements_product_idx").on(t.productId),
    index("movements_type_idx").on(t.type),
  ],
);

// Límites de stock por empresa (mínimo por ingrediente, aplica a todos los locales de la empresa).
export const stockLimits = mysqlTable(
  "stock_limits",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    ingredientId: int("ingredient_id"), // null si el límite es de un producto de reventa
    productId: int("product_id"), // null si el límite es de un ingrediente
    minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    unique("stock_limits_company_ingredient_uq").on(t.companyId, t.ingredientId),
    unique("stock_limits_company_product_uq").on(t.companyId, t.productId),
    index("stock_limits_company_idx").on(t.companyId),
  ],
);

// Combos (a nivel empresa): agrupan varios productos a un precio propio
export const combos = mysqlTable(
  "combos",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    photoUrl: varchar("photo_url", { length: 500 }),
    active: boolean("active").notNull().default(true),
    sort: int("sort").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("combos_company_idx").on(t.companyId)],
);

// Productos que componen un combo (con cantidad)
export const comboProducts = mysqlTable(
  "combo_products",
  {
    id: int("id").autoincrement().primaryKey(),
    comboId: int("combo_id").notNull(),
    productId: int("product_id").notNull(),
    quantity: int("quantity").notNull().default(1),
  },
  (t) => [
    unique("combo_products_uq").on(t.comboId, t.productId),
    index("combo_products_combo_idx").on(t.comboId),
  ],
);

// Pedidos (por local)
export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("location_id").notNull(),
    orderNumber: int("order_number").notNull(),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    deliveryMethod: mysqlEnum("delivery_method", ["local", "mostrador"]).notNull(),
    comments: text("comments"),
    status: mysqlEnum("status", ["recibido", "preparacion", "entregado"])
      .notNull()
      .default("recibido"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    paid: boolean("paid").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_location_idx").on(t.locationId),
    unique("orders_location_number_uq").on(t.locationId, t.orderNumber),
  ],
);

// Ítems del pedido (snapshot de nombre y precio)
export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    productId: int("product_id"),
    productName: varchar("product_name", { length: 120 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);
