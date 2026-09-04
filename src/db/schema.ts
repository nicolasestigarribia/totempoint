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

// Auth: usuarios propios (reemplaza Supabase auth.users)
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sesiones (cookie httpOnly)
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Roles (un usuario puede tener varios)
export const userRoles = mysqlTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    role: mysqlEnum("role", ["superadmin", "business_admin", "kitchen"]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("user_roles_user_role_uq").on(t.userId, t.role)],
);

// Negocios (tenant)
export const businesses = mysqlTable("businesses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 500 }),
  primaryColor: varchar("primary_color", { length: 9 }).default("#000000"),
  phone: varchar("phone", { length: 40 }),
  address: varchar("address", { length: 255 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Categorías del menú (por negocio)
export const categories = mysqlTable(
  "categories",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    businessId: varchar("business_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sort: int("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("categories_business_idx").on(t.businessId)],
);

// Productos (por negocio)
export const products = mysqlTable(
  "products",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    businessId: varchar("business_id", { length: 36 }).notNull(),
    categoryId: varchar("category_id", { length: 36 }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    photoUrl: varchar("photo_url", { length: 500 }),
    active: boolean("active").notNull().default(true),
    sort: int("sort").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("products_business_idx").on(t.businessId)],
);

// Pedidos (por negocio)
export const orders = mysqlTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    businessId: varchar("business_id", { length: 36 }).notNull(),
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
    index("orders_business_idx").on(t.businessId),
    unique("orders_business_number_uq").on(t.businessId, t.orderNumber),
  ],
);

// Ítems del pedido (snapshot de nombre y precio)
export const orderItems = mysqlTable(
  "order_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }),
    productName: varchar("product_name", { length: 120 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);
