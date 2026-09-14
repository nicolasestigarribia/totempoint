import { sql } from "drizzle-orm";
import {
  mysqlTable,
  varchar,
  boolean,
  timestamp,
  int,
  decimal,
  mysqlEnum,
  text,
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

// Usuarios propios. superadmin: companyId/locationId null. admin: ligado a un local.
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 60 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    companyId: int("company_id"),
    locationId: int("location_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("users_company_idx").on(t.companyId),
    index("users_location_idx").on(t.locationId),
  ],
);

// Sesiones (cookie httpOnly). id = token secreto aleatorio, NO autoincrement.
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Roles (un usuario puede tener varios)
export const userRoles = mysqlTable(
  "user_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    role: mysqlEnum("role", ["superadmin", "admin", "kitchen"]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("user_roles_user_role_uq").on(t.userId, t.role)],
);

// Categorías del menú (a nivel empresa)
export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
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
    companyId: int("company_id"),
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
    companyId: int("company_id"),
    categoryId: int("category_id"),
    name: varchar("name", { length: 120 }).notNull(),
    unit: varchar("unit", { length: 20 }),
    // Unidades base por bulto/caja (ej: 1 caja de coca = 6). 1 = no viene en bulto.
    unitsPerBulk: decimal("units_per_bulk", { precision: 10, scale: 2 }).notNull().default("1"),
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

// Stock de cada ingrediente por local.
// stockActual = columna generada: ingresos - ventas - egresos.
export const artistock = mysqlTable(
  "artistock",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    ingredientId: int("ingredient_id").notNull(),
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
    index("artistock_location_idx").on(t.locationId),
    index("artistock_ingredient_idx").on(t.ingredientId),
    index("artistock_company_idx").on(t.companyId),
  ],
);

// Catálogo de códigos de acción para movements. companyId null = global/sistema.
export const actionCodes = mysqlTable(
  "action_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id"), // null = global
    code: varchar("code", { length: 40 }).notNull().unique(),
    label: varchar("label", { length: 120 }).notNull(),
    type: mysqlEnum("type", ["stock", "caja"]).notNull(),
    direction: mysqlEnum("direction", ["ingreso", "egreso"]).notNull(),
    auto: boolean("auto").notNull().default(false), // generado por el sistema (no cargable a mano)
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("action_codes_company_idx").on(t.companyId)],
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
    ingredientId: int("ingredient_id"), // null para movimientos de caja
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
    index("movements_type_idx").on(t.type),
  ],
);

// Límites de stock por empresa (mínimo por ingrediente, aplica a todos los locales de la empresa).
export const stockLimits = mysqlTable(
  "stock_limits",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id").notNull(),
    ingredientId: int("ingredient_id").notNull(),
    minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    unique("stock_limits_company_ingredient_uq").on(t.companyId, t.ingredientId),
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
    status: mysqlEnum("status", ["nuevo", "preparacion", "listo", "entregado"])
      .notNull()
      .default("nuevo"),
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
