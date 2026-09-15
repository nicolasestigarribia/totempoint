# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Burger Point Order** — a touchscreen self-service kiosk ordering app for a burger restaurant (think a McDonald's totem), plus a multi-tenant admin/kitchen back office. Originally scaffolded with [Lovable](https://lovable.dev) (see `.lovable/`); local development now happens directly in this repo.

The original MVP spec (kiosk flow: home → categories → products → cart → checkout → confirmation → kitchen panel, using mocked/local data, no payments/printer/login) lives in `README.md` — read it for the intended UX and copy if working on the kiosk-facing screens. Since that MVP, the project grew a real multi-tenant backend (companies/locations/users/roles, DB-backed catalog, stock ledger) — see Architecture below for how the two layers relate.

## Commands

Package manager is **bun** (`bun.lock`, `bunfig.toml`), not npm/pnpm.

```sh
bun install         # install deps
bun run dev          # vite dev server, fixed port 8081 (strictPort)
bun run build        # production build (nitro)
bun run build:dev    # build in development mode
bun run preview      # preview a production build
bun run lint         # eslint .
bun run format       # prettier --write .
```

There is no test script/framework configured in this repo.

Database (Drizzle + MySQL on Railway): there are no `db:*` npm scripts, so drive `drizzle-kit` directly, e.g. `bunx drizzle-kit push` or `bunx drizzle-kit generate`. `drizzle.config.ts` reads `DATABASE_URL` from `.env.local` (not `.env`). Seed a superadmin user with `bun run src/db/seed.ts` (reads optional `SEED_EMAIL`/`SEED_PASSWORD` env vars, defaults exist).

`bunfig.toml` enforces a 24h supply-chain guard on new package versions (`minimumReleaseAge`). Don't add entries to `minimumReleaseAgeExcludes` without confirming with the user first.

## Architecture

### Two parallel "menu" layers — don't conflate them

- `src/lib/menu.ts` + `src/lib/store.ts` (zustand, `persist` to localStorage) is the **original mocked kiosk flow**: static product/category data and a client-only cart/orders state. The kiosk routes (`index`, `categories`, `menu.$category`, `cart`, `checkout`, `confirmation.$orderId`) still read/write this store — orders placed through the kiosk are *not* yet written to the `orders`/`order_items` DB tables.
- `src/db/schema.ts` + `src/lib/api/*.functions.ts` is the **real DB-backed multi-tenant catalog** (companies, categories, products, combos, ingredients, stock) used by the admin panel (`admin.tsx`) and superadmin panel (`superadmin.tsx`). The `orders`/`order_items` tables exist in the schema and are read by `kitchen.tsx`-style panels' data model, but the kiosk checkout flow hasn't been wired to persist orders there — check current route code before assuming which side an order-related change belongs to.

### Server functions (`src/lib/api/*.functions.ts`)

All backend logic goes through TanStack Start server functions, not a separate API layer:

```ts
export const someFn = createServerFn({ method: "GET" | "POST" })
  .middleware([requireAuth])          // or requireSuperadmin, or omit for public
  .inputValidator(z.object({ ... }))  // zod schema, only for POST/mutations
  .handler(async ({ context, data }) => { ... });
```

- `src/lib/auth/middleware.ts`: `requireAuth` attaches `context.user: SessionUser` or throws; `requireSuperadmin` builds on `requireAuth` and additionally checks `user.roles.includes("superadmin")`.
- Handlers throw plain `Error`s with user-facing Spanish messages (e.g. `"Usuario o contraseña incorrectos"`) — these propagate to the client as the server-fn error and are shown via `sonner` toasts / inline alerts. Follow this convention rather than introducing structured error codes.
- Route-level auth is enforced **client-side**, not via router `beforeLoad`: pages call `me()` in a `useEffect` and `navigate()` away if the user/role doesn't match (see `routes/login.tsx`'s `destinationFor`, `routes/admin.tsx`). The server functions are still the real security boundary via `requireAuth`/`requireSuperadmin`.

### Auth & sessions

Custom cookie-session auth (migrated off Supabase auth) in `src/lib/auth/`:
- `session.ts`: opaque random token stored in the `sessions` MySQL table, set as an httpOnly cookie; `getSessionUser()` joins `sessions` → `users` → `user_roles`.
- `password.ts`: password hashing (bcryptjs).
- Roles are a many-to-many table (`user_roles`: `superadmin` | `admin` | `kitchen`) — a user can hold multiple roles; check with `roles.includes(...)`, not equality.

### Multi-tenant data model (`src/db/schema.ts`)

`companies` (tenant) → `locations` (branches) → `users` (superadmin has null `companyId`/`locationId`; `admin`/`kitchen` users are scoped to a company/location). Most catalog tables (`categories`, `products`, `combos`, `stockLimits`) carry `companyId` and are tenant-scoped. `ingredientCategories`, `ingredients`, and `actionCodes` use `companyId: null` to mean "global/system-managed by superadmin" vs. a set value meaning company-private — check for null, don't assume every row is tenant-owned.

Per-location overrides (`locationProducts`, `locationCategories`) flip availability off for a specific branch; absence of a row means "available" (inherits from `product.active`/`category.active`).

`movements` is an append-only ledger (`type`: `stock` | `caja`, `actionCode` from `action_codes`, signed `amount`) that is the source of truth for both stock and cash; `artistock.stockActual` is a MySQL *generated* column (`ip_local - vp_local - ep_local`) derived from aggregated movement totals — don't write to `stockActual` directly, write a `movements` row and let the aggregates (`ipLocal`/`vpLocal`/`epLocal`) follow.

### Routing (TanStack Start file-based)

See `src/routes/README.md` for the file-naming convention (`$id` dynamic, `{-$cat}` optional, `$` splat, `_layout`, `__root.tsx`). `src/routeTree.gen.ts` is auto-generated — never hand-edit it. The only app shell/layout is `__root.tsx`; do not create Next/Remix-style `src/pages/` or `app/` directories.

### SSR error handling

There's a deliberate two-layer error wrapper because h3 (TanStack Start's server) can swallow in-handler throws into an opaque `{"unhandled":true,"message":"HTTPError"}` 500 that a plain `try/catch` won't see:
- `src/start.ts` registers `errorMiddleware` (catches request-level errors, renders `renderErrorPage()`).
- `src/server.ts` wraps the whole `fetch` handler and additionally detects/normalizes the swallowed-h3-error JSON shape via `src/lib/error-capture.ts` + `src/lib/error-page.ts`.

Don't remove either layer when touching server entry code — they cover different failure modes.

### Vite config

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`'s `defineConfig`, which already wires up `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, nitro, the `@` path alias, and dev-only plugins. Do not add these plugins manually — the comment in the file warns this causes duplicate-plugin breakage. Pass extra config via the `vite`/`tanstackStart` keys of `defineConfig` instead.

### Deployment

Built with the Dockerfile (bun for install/build → `node:22-slim` runtime running the nitro `node-server` preset output, `.output/server/index.mjs`) and deployed to **Railway** per `railway.json`. `DATABASE_URL` (Railway MySQL) is read from `.env.local` locally and from Railway env vars in production.

### Legacy Supabase remnants

`supabase/` (config + old migrations) and the `SUPABASE_*`/`VITE_SUPABASE_*` vars in `.env` are leftovers from before the project migrated to Railway MySQL + its own cookie-session auth (see git history: "Migrate from Supabase to Railway MySQL + own auth"). They are not read by any active code path — don't wire new features to them; the live DB config is `.env.local`'s `DATABASE_URL` plus `src/db/index.ts`/`drizzle.config.ts`.
