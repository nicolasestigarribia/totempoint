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

`.gitattributes` pins the repo to LF (Prettier's default). Before it existed, Windows checkouts rewrote files to CRLF and `bun run lint` reported ~15k phantom `Delete ␍` errors. About 321 real formatting errors remain in files nobody touched (`components/ui/*`, older admin sections); `bun run format` fixes them but rewrites half the repo, so coordinate that with the team rather than doing it inside an unrelated change.

## Architecture

### One totem flow: `/t/$slug`

- **`/t/$slug/*` is the totem**, multi-tenant and the only ordering flow there is. Routes: `t.$slug.index` (cover), `t.$slug.categorias`, `t.$slug.menu.$category`, `t.$slug.carrito`, `t.$slug.checkout`, `t.$slug.listo.$orderId`. It reads the DB catalog through `src/lib/api/totem.functions.ts` and persists real orders.
- The old single-brand Burger Point demo (`src/lib/menu.ts`, `src/lib/store.ts`, `TotemHeader`, and the bare `categories` / `menu.$category` / `cart` / `checkout` / `confirmation.$orderId` routes) **was deleted**: it served a hardcoded menu whose orders never reached the database, and a tablet left on `/` could take fake orders. Don't reintroduce a demo flow at the root.
- **`/` is the platform's landing page**, not a business: the Totempoint pitch plus a link to `/login`. A totem is always opened by its own slug URL.

### The public kiosk layer (`src/lib/api/kiosk.functions.ts`)

This is the **only file with server functions that have no auth middleware** — the totem runs without a session. Everything else in `src/lib/api/` requires `requireAuth`/`requireSuperadmin`, so keep authenticated helpers out of this file to avoid accidentally exposing them.

- A business is resolved by `companies.slug` from the URL (`/k/primorosas`). The slug is generated from the name in `createBusiness` and is not editable from any panel.
- `getKioskHome` (cover), `getKioskMenu` (catalog), `createKioskOrder`, `getKioskOrder`.
- `createKioskOrder` receives only product ids and quantities; **prices and the total are recomputed server-side** from the DB. Never trust amounts sent by the client.
- Products with no `categoryId` are grouped under a synthetic category with id `0` (`UNCATEGORIZED`, shown as "Otros") so they can't become invisible.
- Order numbers are `MAX(order_number) + 1` per location inside a transaction, starting at 100. The totem only knows the company, so orders are attached to the company's first active location.
- Per-location availability (`locationProducts`/`locationCategories`) is **not** applied by the kiosk yet — it reads the company-level catalog.

### Totem cover and kiosk behaviour

`kioskSettings` holds one row per company (template, hero image, eyebrow, title + accent, subtitle, CTA label, two badges, accent color) and is edited in the admin's "Portada" section, which renders a live scaled preview of the real `KioskHome` component. Three templates live in `src/components/kiosk/KioskHome.tsx`: `clasico`, `completo`, `split`.

`useKioskIdleReset` sends the totem back to the cover and clears the cart after 90s without interaction, so one customer never inherits another's order. The cart (`src/lib/kiosk-cart.ts`) stores the slug it belongs to and empties itself if the tablet switches businesses.

### Images are stored in MySQL, not in object storage

There is deliberately **no S3/R2 integration**: the user rejected any vendor requiring a credit card. `ImageUploadField` resizes and re-encodes the file to WebP in the browser (max 1600px, quality 0.82 — a 550KB photo lands around 8KB), sends base64 to `uploadImage`, and the row goes into the `images` table. Files are served by `serveImage` in `src/lib/images.ts`, which `src/server.ts` intercepts at `/img/:id` **before the request reaches the router** — this is not a TanStack route. Ids are never reused, so responses are cached immutably. Old images are not garbage-collected when a cover is replaced.

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

`companies` (tenant) → `locations` (branches) → `users` (superadmin has null `companyId`/`locationId`; `owner`/`encargado`/`kitchen` users are scoped to a company). **Every catalog table carries a non-null `companyId`** — `categories`, `products`, `combos`, `stockLimits`, and also `ingredients`, `ingredientCategories` and `actionCodes`, which used to allow `companyId: null` to mean "global, managed by the superadmin". That global concept was removed: what a business puts in its products is that business's data, so there is no shared catalog and the superadmin panel only administers companies. `action_codes.code` is unique per company, not platform-wide.

**Vocabulary:** an **empresa** is the tenant (`companies`) — what the superadmin creates and hands to an owner; a **negocio** is one of its branches (`locations`), created by the owner, e.g. "PrimoRosas Cariló". The UI used to call the tenant "negocio" and the branch "local"; that wording was corrected, while the table names stayed. Say empresa for the tenant and negocio for the branch in any user-facing copy.

Roles are `superadmin | owner | encargado | kitchen`. The superadmin has access to everything: `enterBusiness`/`exitBusiness` (`platform.functions.ts`) store the company being visited in an `acting_company` httpOnly cookie, and `getSessionUser` resolves `companyId` from it, so every company-scoped server function works unchanged while the superadmin is inside a business. An `encargado` is assigned one or more locations through `user_locations`; `src/lib/auth/scope.ts` (`accessibleLocationIds`, `assertLocationAccess`) is the single place that decides which locations a caller may touch, and `requireOwner` in `src/lib/auth/middleware.ts` guards owner-only operations (operators, locations).

Per-location overrides (`locationProducts`, `locationCategories`) flip availability off for a specific branch; absence of a row means "available" (inherits from `product.active`/`category.active`).

`orders`/`order_items` are now written by the kiosk checkout and read by `kitchen.tsx` through `src/lib/api/orders.functions.ts` (scoped to the caller's company via its locations). `order_items` snapshots product name and unit price, so editing a product later never rewrites past orders.

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

## Known gaps (next steps)

Verified working end to end: business signup → owner login → cover setup → image upload → catalog on the totem → cart → checkout → order in the DB → kitchen panel. What is still missing:

- **Combos never reach the totem.** `getKioskMenu` returns categories and products only.
- **The slug can't be edited** from any panel, and no screen shows the full totem URL. A "copy link + QR" block in the Portada section was proposed and not built — installing a new totem currently means typing a long Railway URL on a tablet.
- **No kitchen users.** `createBusiness` only creates an `admin`; the `kitchen` role exists in `user_roles` but nothing creates users with it, so `/kitchen` is reached with the admin account.
- **A logged-in session on the totem tablet is a hole**: `/k/$slug` has no way out, but if the owner logs in on that tablet and doesn't log out, anyone typing `/admin` gets the panel. Mitigated only by procedure (administer from a phone/PC, lock the tablet with the OS kiosk mode).
- **Location is implicit.** Orders go to the company's first active location; a multi-branch business needs the totem to know which branch it is (device pairing was discussed as the eventual fix).
- **`.env` is committed to the repo**, so its keys are in git history. Pre-existing, flagged to the user, untouched — removing it means rewriting history and rotating keys.

### Legacy Supabase remnants

`supabase/` (config + old migrations) and the `SUPABASE_*`/`VITE_SUPABASE_*` vars in `.env` are leftovers from before the project migrated to Railway MySQL + its own cookie-session auth (see git history: "Migrate from Supabase to Railway MySQL + own auth"). They are not read by any active code path — don't wire new features to them; the live DB config is `.env.local`'s `DATABASE_URL` plus `src/db/index.ts`/`drizzle.config.ts`.
