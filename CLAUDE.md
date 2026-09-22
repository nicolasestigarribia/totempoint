# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Totempoint** — self-service ordering totems for food businesses, plus the multi-tenant back office behind them. A customer orders from a tablet at the counter and the ticket reaches the business; one installation serves many brands, each with its own catalog, cover screen and staff. It was scaffolded with [Lovable](https://lovable.dev) (see `.lovable/`) as a single-brand burger demo called "Burger Point"; that demo was deleted and the name is gone — don't reintroduce it anywhere, in copy, titles or metadata.

`README.md` describes the product and how to run it.

`PARA-NICOLAS.md` is a handoff briefing in Spanish: the business rules and invariants that must not be changed, and the work still pending. Keep it in sync when either of those moves.

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

Tests run with bun's built-in runner (`bun run test`). Coverage is deliberately narrow: `src/lib/auth/permissions.test.ts` pins the permission rules, which are the part that fails silently. Everything else is still verified by hand.

Database (Drizzle + MySQL on Railway): there are no `db:*` npm scripts, so drive `drizzle-kit` directly, e.g. `bunx drizzle-kit push` or `bunx drizzle-kit generate`. `drizzle.config.ts` reads `DATABASE_URL` from `.env.local` (not `.env`). Seed a superadmin user with `bun run src/db/seed.ts` (reads optional `SEED_EMAIL`/`SEED_PASSWORD` env vars, defaults exist). `bun run src/db/seed-action-codes.ts [slug]` loads a company's movement reasons; without them the Stock section shows its button but the "Motivo" dropdown is empty and nothing can be registered by hand.

`bunfig.toml` enforces a 24h supply-chain guard on new package versions (`minimumReleaseAge`). Don't add entries to `minimumReleaseAgeExcludes` without confirming with the user first.

`.gitattributes` pins the repo to LF (Prettier's default). Before it existed, Windows checkouts rewrote files to CRLF and `bun run lint` reported ~15k phantom `Delete ␍` errors. About 321 real formatting errors remain in files nobody touched (`components/ui/*`, older admin sections); `bun run format` fixes them but rewrites half the repo, so coordinate that with the team rather than doing it inside an unrelated change.

## Architecture

### One totem flow: `/t/$slug`

- **`/t/$slug/*` is the totem**, multi-tenant and the only ordering flow there is. Routes: `t.$slug.index` (cover), `t.$slug.categorias`, `t.$slug.menu.$category`, `t.$slug.carrito`, `t.$slug.checkout`, `t.$slug.listo.$orderId`. It reads the DB catalog through `src/lib/api/totem.functions.ts` and persists real orders.
- The old single-brand Burger Point demo (`src/lib/menu.ts`, `src/lib/store.ts`, `TotemHeader`, and the bare `categories` / `menu.$category` / `cart` / `checkout` / `confirmation.$orderId` routes) **was deleted**: it served a hardcoded menu whose orders never reached the database, and a tablet left on `/` could take fake orders. Don't reintroduce a demo flow at the root.
- **`/` is the platform's landing page**, not a business: the Totempoint pitch plus a link to `/login`. A totem is always opened by its own slug URL.

### The public totem layer (`src/lib/api/totem.functions.ts`)

This is the **only file with server functions that have no auth middleware** — the totem runs without a session. Everything else in `src/lib/api/` requires `requireAuth`/`requireSuperadmin`, so keep authenticated helpers out of this file to avoid accidentally exposing them.

- A business is resolved by `companies.slug` from the URL (`/t/primorosas`). The slug is generated from the name in `createBusiness` and is not editable from any panel.
- `getTotemHome` (cover), `getTotemMenu` (catalog + combos), `createTotemOrder`, `getTotemOrder`.
- `createTotemOrder` receives lines of `{kind: "producto" | "combo", id, quantity}`; **prices and the total are recomputed server-side** from the DB. Never trust amounts sent by the client. A combo is stored as one `order_items` row with `product_id` null and the combo's name and price, which `order_items` already freezes.
- Products with no `categoryId` are grouped under a synthetic category with id `0` (`UNCATEGORIZED`, shown as "Otros") so they can't become invisible.
- Order numbers are `MAX(order_number) + 1` per location inside a transaction, starting at 100. The totem only knows the company, so orders are attached to the company's first active location.
- Per-location availability (`locationProducts`/`locationCategories`) is **not** applied by the totem yet — it reads the company-level catalog.

### Totem cover and behaviour

`totemSettings` holds one row per company (template, colour base, hero image, eyebrow, title + accent, subtitle, CTA label, two badges, accent colour) and is edited in the admin's "Portada" section, which renders the real `TotemHome` inside `PreviewFrame` — an iframe with its own 1280x800 window, because the cover's `min-h-dvh` and `lg:` classes measure the window and a scaled div showed the phone layout. Three templates live in `src/components/totem/TotemHome.tsx`: `clasico`, `completo`, `split`. `useTotemTheme` tints every totem screen with the company's colour over the chosen base.

The customer's path is always visible: `TotemPasos` in the top bar shows which of the three steps they are on (elegí → tu pedido → confirmá), and `TotemCartBar` is pinned to the bottom of the browsing screens with the running total, appearing with the first product. Both answer the two questions somebody standing at a totem actually has — how much am I spending, and how do I go on — without them having to tap anything to find out. The cart and checkout pin their total and their button the same way, because the last thing you have to do on a screen should never be below the fold.

**Whoever adds a section to the panel must extend `user_permissions.section` in the database too.** That enum used to be rewritten wholesale by each migration with whatever list it knew about, and with two people working in parallel one of them silently dropped the other's section — it compiles, it boots, and it only fails when somebody tries to grant that permission. `bun run src/db/migrate-panel-sections.ts` rebuilds the enum from `PANEL_SECTIONS`, so the code is the source of truth; run it after adding one.

`useTotemIdleReset` sends the totem back to the cover and clears the cart after 90s without interaction, so one customer never inherits another's order. The cart (`src/lib/totem-cart.ts`) stores the slug it belongs to, empties itself if the tablet switches businesses, and keys each line by `kind + refId` so a product and a combo with the same id never collide.

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
- Handlers throw plain `Error`s with user-facing Spanish messages (e.g. `"Usuario o contraseña incorrectos"`) — these propagate to the client as the server-fn error and are shown via `sonner` toasts / inline alerts. Follow this convention rather than introducing structured error codes. What a handler throws arrives readable; what the `inputValidator` rejects arrives as zod's serialized issue array, so show it through `mensajeDeError` (`src/lib/error-message.ts`) instead of printing `err.message`, which would put raw JSON on screen.
- Route-level auth is enforced **client-side**, not via router `beforeLoad`: pages call `me()` in a `useEffect` and `navigate()` away if the user/role doesn't match (see `routes/login.tsx`'s `destinationFor`, `routes/admin.tsx`). The server functions are still the real security boundary via `requireAuth`/`requireSuperadmin`.

### Auth & sessions

Custom cookie-session auth (migrated off Supabase auth) in `src/lib/auth/`:

- `session.ts`: opaque random token stored in the `sessions` MySQL table, set as an httpOnly cookie; `getSessionUser()` joins `sessions` → `users` → `user_roles`. A session also dies after 12h without use (`last_seen_at`, refreshed at most every 5 minutes) — the only thing limiting a tablet left logged in at the counter.
- `throttle.ts`: five failed logins lock that identifier for 15 minutes (`login_attempts`). It counts by username/email rather than IP, which Railway's proxy makes unreliable; the trade-off is that someone can lock a known user out for a short while on purpose.
- The superadmin password is changed with `SEED_PASSWORD="..." bun run src/db/set-superadmin-password.ts`, which also drops that user's sessions.
- `password.ts`: password hashing (bcryptjs).
- `password-policy.ts`: the single rule for credentials — 8+ characters with a letter and a digit, no catalogue passwords, and an email that can actually receive mail. Every path that creates or changes a user must use `passwordSchema`/`emailSchema`; the user asked for this explicitly and it is covered by tests.
- **There is no password recovery by email yet.** The user chose to keep resets manual rather than add a mail provider: an owner resets his operators from Operadores, and the superadmin resets an owner from Credenciales. The email is validated because that flow is meant to arrive later; the login page says who to ask meanwhile. What does exist is `/cuenta` (`changeMyPassword`), where anyone logged in changes their own password — it asks for the current one even with a session open, so a tablet left unlocked can't lock its owner out.
- **Changing or revoking access must kill the open sessions.** `destroyUserSessions(userId, keepToken?)` in `session.ts` is called when an operator's password is reset, when a user is deactivated, when the superadmin changes an owner's credentials and when a company is deactivated (the session only checks whether the *user* is active, not the company). Without it, resetting the password of someone who just left changes nothing until their session expires on its own. Changing your own password keeps the current session and drops the rest.
- Roles are a many-to-many table (`user_roles`: `superadmin` | `admin` | `kitchen`) — a user can hold multiple roles; check with `roles.includes(...)`, not equality.

### Multi-tenant data model (`src/db/schema.ts`)

`companies` (tenant) → `locations` (branches) → `users` (superadmin has null `companyId`/`locationId`; `owner`/`encargado`/`kitchen` users are scoped to a company). **Every catalog table carries a non-null `companyId`** — `categories`, `products`, `combos`, `stockLimits`, and also `ingredients`, `ingredientCategories` and `actionCodes`, which used to allow `companyId: null` to mean "global, managed by the superadmin". That global concept was removed: what a business puts in its products is that business's data, so there is no shared catalog and the superadmin panel only administers companies. `action_codes.code` is unique per company, not platform-wide.

**Vocabulary:** an **empresa** is the tenant (`companies`) — what the superadmin creates and hands to an owner; a **negocio** is one of its branches (`locations`), created by the owner, e.g. "PrimoRosas Cariló". The UI used to call the tenant "negocio" and the branch "local"; that wording was corrected, while the table names stayed. Say empresa for the tenant and negocio for the branch in any user-facing copy.

Roles are `superadmin | owner | encargado | kitchen`. The superadmin has access to everything: `enterBusiness`/`exitBusiness` (`platform.functions.ts`) store the company being visited in an `acting_company` httpOnly cookie, and `getSessionUser` resolves `companyId` from it, so every company-scoped server function works unchanged while the superadmin is inside a business. An `encargado` is assigned one or more locations through `user_locations`; `src/lib/auth/scope.ts` (`accessibleLocationIds`, `assertLocationAccess`) is the single place that decides which locations a caller may touch, and `requireOwner` in `src/lib/auth/middleware.ts` guards owner-only operations (operators, locations).

Every server function that writes must check the permission, not just the company: `requireCompany` answers "do you belong here?", never "were you allowed to do this?". Two of them were missing it — `createMovement` let a read-only encargado move stock and cash, and `setOrderStatus` let any operator advance orders — so when adding a mutation, gate it with `requireEdit(section)` or an explicit `canEdit` check. The kitchen is the one place the permission matrix isn't enough: the `kitchen` role works there and has no sections ticked, so `assertCanViewKitchen`/`assertCanOperateKitchen` in `scope.ts` own that rule.

On the client, `ReadOnlyContext` (`src/components/admin/readonly.ts`) tells a section it is being viewed with "solo ver": sections hide the create button, the actions column and the status switches, and keep search, filters, sorting and paging. It is cosmetic — the server is still the boundary — but without it the panel offers buttons that always fail. `admin.tsx` computes the value and provides it; Comandera is not a panel section but its own screen, so it gets a plain link in the sidebar instead of a nav entry.

Per-location overrides (`locationProducts`, `locationCategories`) flip availability off for a specific branch; absence of a row means "available" (inherits from `product.active`/`category.active`).

`orders`/`order_items` are written by the totem checkout and read by `kitchen.tsx` through `src/lib/api/orders.functions.ts` (scoped to the caller's company via its locations). `order_items` snapshots product name and unit price, so editing a product later never rewrites past orders.

An order also carries the money side: `businessDate` (the jornada it belongs to), `paymentMethod` (`efectivo` | `mercadopago`) and `paymentStatus` (`pendiente` | `pagado` | `reembolso_pendiente`). `orderNumber` restarts at 1 every morning per location — that is why the unique key is `(location, businessDate, orderNumber)` and why `businessDate` is stored instead of derived from `createdAt`. Cancelling is its own server function (`cancelOrder`), not a status change: it decides what happens to money already taken, and a cancelled order never goes back so the day's cash close doesn't change after the fact. `getCashClose` sums only what someone marked as cobrado, which is what you compare against the physical till.

`movements` is an append-only ledger (`type`: `stock` | `caja`, `actionCode` from `action_codes`, signed `amount`) that is the source of truth for both stock and cash; `artistock.stockActual` is a MySQL _generated_ column (`ip_local - vp_local - ep_local`) derived from aggregated movement totals — don't write to `stockActual` directly, write a `movements` row and let the aggregates (`ipLocal`/`vpLocal`/`epLocal`) follow.

### Routing (TanStack Start file-based)

See `src/routes/README.md` for the file-naming convention (`$id` dynamic, `{-$cat}` optional, `$` splat, `_layout`, `__root.tsx`). `src/routeTree.gen.ts` is auto-generated — never hand-edit it. The only app shell/layout is `__root.tsx`; do not create Next/Remix-style `src/pages/` or `app/` directories.

### SSR error handling

There's a deliberate two-layer error wrapper because h3 (TanStack Start's server) can swallow in-handler throws into an opaque `{"unhandled":true,"message":"HTTPError"}` 500 that a plain `try/catch` won't see:

- `src/start.ts` registers `errorMiddleware` (catches request-level errors, renders `renderErrorPage()`).
- `src/server.ts` wraps the whole `fetch` handler and additionally detects/normalizes the swallowed-h3-error JSON shape via `src/lib/error-capture.ts` + `src/lib/error-page.ts`.

Don't remove either layer when touching server entry code — they cover different failure modes.

### Vite config

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`'s `defineConfig`, which already wires up `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, nitro, the `@` path alias, and dev-only plugins. Do not add these plugins manually — the comment in the file warns this causes duplicate-plugin breakage. Pass extra config via the `vite`/`tanstackStart` keys of `defineConfig` instead.

### UI conventions

- **Vocabulary: a location is a "Sucursal" in the UI.** The tenant is an *empresa* (`companies`); each branch (`locations`) is shown as **Sucursal / Sucursales** in all user-facing text (Nicolas' decision, replacing the earlier "Negocio"). Keep gender agreement — *sucursal* is feminine (una sucursal, la sucursal, las sucursales). The delivery method label "Comer en el local" is unrelated (dine-in) and stays. Internal identifiers stay in English (`locations`, `locationId`, `LocalesSection`).
- **Scrollbars use the system colour.** All scrollbars in the app are styled globally in `src/styles.css` with the `*` selector: `scrollbar-color: var(--primary) transparent` plus the `::-webkit-scrollbar` rules (thin, rounded thumb in `var(--primary)`, transparent track). Do not add per-element scrollbar styles that diverge from this; if a new surface scrolls, it inherits the global style automatically. In the totem `var(--primary)` follows the chosen theme, so the bars re-colour per shop.

### Deployment

Built with the Dockerfile (bun for install/build → `node:22-slim` runtime running the nitro `node-server` preset output, `.output/server/index.mjs`) and deployed to **Railway** per `railway.json`. `DATABASE_URL` (Railway MySQL) is read from `.env.local` locally and from Railway env vars in production.

## Known gaps (next steps)

Verified working end to end: business signup → owner login → cover setup → image upload → catalog on the totem → cart → checkout → order in the DB → kitchen panel. What is still missing:

- The slug **is** editable, but only by the superadmin (`updateBusinessSlug`), because changing it breaks the previous link and any printed QR. The full totem URL and its QR show in the Portada section (`TotemLinkCard`). A company left without an owner is no longer a dead end either: `assignBusinessOwner` creates one.
- **Mercado Pago charges per company, into the company's own account.** Each owner pastes their access token in the Cobros section; it lives in `payment_settings`, never leaves the server, and `getTotemMenu` only exposes a boolean so the totem knows whether to offer the button. Paying is a QR on the totem screen that the customer scans with their phone (`/t/$slug/pagar/$orderId`), built from a Checkout Pro preference. The order is saved **before** asking Mercado Pago for the preference, so if Mercado Pago is down the order is still taken and the counter can charge cash.

  Two things confirm a payment: the webhook at `/api/mp/webhook` (intercepted in `src/server.ts`, like `/img/`), and the totem asking every few seconds while the customer pays. The poll is not a development crutch — the webhook can be lost in production too, and there is someone standing in front of the screen. The webhook takes **only the payment id** from the notification and asks Mercado Pago for the rest, because that endpoint is public and anyone can hit it claiming an order was paid.

  **Never export a plain function that touches the database from a `*.functions.ts` file.** Only server functions get stripped from the client bundle; an ordinary export stays and drags drizzle and the MySQL driver into the browser, which throws on load and leaves the whole app without JavaScript. That is why `acreditarPedido` lives in `src/lib/payments/acreditar.ts` and not next to the totem's server functions.
- **Prices are per company, not per location** (point 6 of the business rules), and neither is the price-change audit. Same for a location's own products and for per-product customisation (points 5 and 7).
- A logged-in session on the totem tablet used to be a hole — `/t/$slug` has no way out, but the address bar does. The link the panel hands out for the tablet now ends in `?totem=1`: `useTotemDevice` marks that browser and, every time the cover loads, calls `leaveStaffSession` to drop any panel session left open there. `?totem=0` removes the mark, and the panel's own "Abrir" button uses the bare link so previewing from a PC doesn't log you out. It is still worth locking the tablet in the OS kiosk mode.
- **Location is implicit.** Orders go to the company's first active location; a multi-branch business needs the totem to know which branch it is (device pairing was discussed as the eventual fix).
- **`.env` is committed to the repo**, so its keys are in git history. Pre-existing, flagged to the user, untouched — removing it means rewriting history and rotating keys.

### Legacy Supabase remnants

`supabase/` (config + old migrations) and the `SUPABASE_*`/`VITE_SUPABASE_*` vars in `.env` are leftovers from before the project migrated to Railway MySQL + its own cookie-session auth (see git history: "Migrate from Supabase to Railway MySQL + own auth"). They are not read by any active code path — don't wire new features to them; the live DB config is `.env.local`'s `DATABASE_URL` plus `src/db/index.ts`/`drizzle.config.ts`.
