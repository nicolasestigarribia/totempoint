# Menú online con identidad del tótem — Plan de implementación (Parte 1: menú)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el menú del pedido online (`/p/$empresa/$local`) y en mesa (`/m/$token`) se vea y se recorra como el tótem: grilla de categorías con foto al entrar, y al tocar una, lista continua de todas las categorías con tarjetas grandes y carrusel fijo.

**Architecture:** Solo cliente. `MenuOnline.tsx` queda como orquestador (encabezado, franja, búsqueda, modo grilla/lista, barra del pedido); la tarjeta, la grilla y el carrusel salen a `src/components/online/menu/`. La categoría abierta vive en el hash de la URL (`#categoria-12`, `#categoria-combos`) para que "atrás" del navegador vuelva a la grilla. La búsqueda y el parseo del hash son funciones puras en `src/lib/menu-online.ts`, con tests.

**Tech Stack:** React 19, TanStack Router (`useRouter().history`, `useLocation`), Tailwind 4, lucide-react, bun test.

Spec: `docs/superpowers/specs/2026-10-13-menu-online-identidad-design.md`. Partes 2 (carrito) y 3 (seguimiento) tienen su propio plan, que se escribe al terminar esta.

## Global Constraints

- Copy de UI en español rioplatense; identificadores nuevos pueden ser en español como el resto del archivo (`TarjetaProducto`, `abrir`).
- Sucursal (femenino) para `locations`; nunca "local"/"negocio" en texto nuevo.
- Nada de `window.confirm/alert/prompt`.
- Toda animación nueva bajo `@media (prefers-reduced-motion: reduce) { animation: none }`.
- Fotos con `loading="lazy"`; el carrusel sticky sin `backdrop-filter`.
- No cambia ninguna server function, `totem-cart.ts`, precios ni validaciones.
- Modo `SoloVer` (`?ver=1`): sin agregar, sin pan, sin repetir, sin barra del pedido.
- No commitear: el usuario commitea cuando lo pide.
- bun: `~/.bun/bin/bun.exe` (el del PATH está roto).

## File Structure

- Create `src/lib/menu-online.ts` — puras: `normalizar`, `partirNombre`, `buscarEnMenu`, `hashDeSeccion`, `seccionDelHash`, `ID_COMBOS`, `idDeCategoria`.
- Create `src/lib/menu-online.test.ts`.
- Create `src/components/online/menu/solo-ver.ts` — el contexto `SoloVer`.
- Create `src/components/online/menu/TarjetaProducto.tsx` — `TarjetaGrande`, `Cantidad` (con "+1"), `TarjetaProducto`, `TarjetaCombo`.
- Create `src/components/online/menu/GrillaCategorias.tsx`.
- Create `src/components/online/menu/CarruselCategorias.tsx`.
- Modify `src/components/online/MenuOnline.tsx` — usa todo lo anterior; borra `FilaProducto`, `FilaCombo`, `TarjetaMenu`, `Foto`, `Cantidad`, `ChipCategoria`, `normalizar`, `partirNombre`.
- Modify `src/styles.css` — `sube-uno` (el "+1").
- Modify `CLAUDE.md` — párrafo del menú online.

---

### Task 1: Funciones puras del menú

**Files:** Create `src/lib/menu-online.ts`, `src/lib/menu-online.test.ts`

**Interfaces — Produces:**
```ts
export const ID_COMBOS = "combos";
export function idDeCategoria(id: number): string;            // "cat-12"
export function normalizar(t: string): string;
export function partirNombre(nombre: string): { numero: string | null; resto: string };
export function buscarEnMenu(busqueda: string, combos: TotemCombo[], productos: TotemProduct[]):
  { combos: TotemCombo[]; productos: TotemProduct[] } | null;  // null si la búsqueda está vacía
export function hashDeSeccion(seccion: string): string;        // "cat-12" → "categoria-12", "combos" → "categoria-combos"
export function seccionDelHash(hash: string, secciones: string[]): string | null;
```

- [ ] **Step 1: Tests** — `menu-online.test.ts`:
  - `normalizar("Jamón")` → `"jamon"`.
  - `partirNombre("01 · Jamón y queso")` → `{numero:"1", resto:"Jamón y queso"}`; sin número queda igual.
  - `buscarEnMenu("  ", …)` → `null`; `"jamon"` encuentra "Jamón crudo" por nombre y un combo por un ítem; productos ordenados con `localeCompare(..., {numeric:true})` ("2 ·" antes que "10 ·").
  - `hashDeSeccion`/`seccionDelHash` ida y vuelta, con y sin `#`; un hash de una categoría que no está en `secciones` → `null`; `""` → `null`.
- [ ] **Step 2:** `~/.bun/bin/bun.exe test src/lib/menu-online.test.ts` → falla (módulo no existe).
- [ ] **Step 3:** Implementar moviendo `normalizar`, `partirNombre` y la búsqueda de `MenuOnline.tsx` tal cual (mismo comportamiento), más las dos del hash.
- [ ] **Step 4:** Test pasa.

### Task 2: Tarjeta grande de producto y combo

**Files:** Create `src/components/online/menu/solo-ver.ts`, `src/components/online/menu/TarjetaProducto.tsx`; Modify `src/styles.css`

**Interfaces — Produces:**
```ts
export const SoloVer: React.Context<boolean>;
export function TarjetaProducto(p: { producto: TotemProduct; cartKey: string; accent: string; indice: number }): JSX.Element;
export function TarjetaCombo(p: { combo: TotemCombo; cartKey: string; accent: string; indice: number }): JSX.Element;
```

- `TarjetaGrande` (interna): `article.aparece` redondeado 3xl, `animationDelay = min(indice, 6) * 50ms`; borde de acento 2px si hay unidades en el carrito.
  - Foto `h-48` con `loading="lazy"` y el efecto `cargando-foto` mientras carga (como el `Foto` actual); degradado de abajo; nombre en `font-display text-3xl text-white` sobre la foto; insignia `N°{numero}` arriba a la izquierda (de `partirNombre`).
  - Sin foto: fondo con degradado del acento (`linear-gradient(135deg, accent, transparent)` sobre `bg-card`) y el nombre igual.
  - Cuerpo: contenido (descripción completa, sin "Ver más"), opciones (pan / `ElegirGustos`), pie con precio `font-display text-3xl` en acento y el control.
- `Cantidad`: "+ Agregar" `h-12 rounded-2xl px-5 font-display text-lg uppercase`; con unidades, `− n +` de `h-12` (🗑 `Trash2` cuando es 1), respetando `MAX_POR_LINEA`. Cada agregar suma un `<span class="sube-uno">+1</span>` absoluto sobre el botón que se borra a los 700 ms.
- `TarjetaProducto`: misma lógica que `FilaProducto` (pan elegido, `itemKey`, aviso "Le podés sacar o agregar cosas desde tu pedido", `regaloDeProducto`), con `TarjetaGrande`.
- `TarjetaCombo`: misma lógica que `FilaCombo` (a elección con `ElegirGustos`, "Otro (n)", toast al agregar); el contenido muestra descripción, "Trae N unidades" y la lista de ítems y grupos completa.
- CSS en `styles.css`, junto a `latido`:
```css
@keyframes sube-uno { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-36px); } }
.sube-uno { animation: sube-uno 700ms ease-out forwards; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .sube-uno { display: none; } }
```
- [ ] Verificar: `~/.bun/bin/bun.exe x tsc --noEmit` sin errores nuevos en estos archivos.

### Task 3: Grilla y carrusel de categorías

**Files:** Create `src/components/online/menu/GrillaCategorias.tsx`, `src/components/online/menu/CarruselCategorias.tsx`

**Interfaces — Produces:**
```ts
export interface CategoriaVisible { id: string; nombre: string; foto: string | null; cantidad: number }
export function GrillaCategorias(p: { categorias: CategoriaVisible[]; accent: string; onAbrir: (id: string) => void }): JSX.Element;
export function CarruselCategorias(p: { categorias: CategoriaVisible[]; activa: string | null; accent: string;
  onElegir: (id: string) => void; onVolver: () => void }): JSX.Element;
```
- Grilla: título "¿Qué vas a <span acento>pedir</span>?"; `grid grid-cols-2 gap-3`; la primera `col-span-2 h-40`, el resto `h-32`; tarjetas `aparece` escalonadas 70 ms, foto lazy + degradado, nombre `font-display text-2xl`, "N productos". Sin foto: degradado del acento. Botón accesible (`<button>` con `aria-label`).
- Carrusel: `nav sticky top-16 z-20 bg-background` (sin blur); botón "‹" (`ChevronLeft`, `aria-label="Ver categorías"`) que llama `onVolver`; tiras `h-16 w-32` con foto y nombre, borde de acento en la activa (`aria-current`). Se corre solo para centrar la activa (la lógica del `useEffect` de la barra actual).

### Task 4: `MenuOnline` con modo grilla / lista

**Files:** Modify `src/components/online/MenuOnline.tsx`

- Secciones visibles: `combos` (si hay; foto = primera foto de combo) + cada categoría con productos (`idDeCategoria`, foto de la categoría, cantidad).
- `abierta = seccionDelHash(useLocation({select: l => l.hash}), ids)`; con una sola sección, siempre lista (sin grilla).
- `abrir(id)`: `router.history.push(pathname + searchStr + "#" + hashDeSeccion(id))`; `volver()`: `router.history.back()` si se entró desde la grilla en esta visita, si no `replace` sin hash. Al pasar a lista, `useLayoutEffect` lleva el scroll a la sección sin animación (`scrollIntoView({block:"start"})`, las secciones tienen `scroll-mt-36`); al volver a la grilla, `window.scrollTo(0, 0)`.
- Arriba (en los dos modos): franja (`InfoDelLocal`/`InfoDeMesa`/solo ver), aviso de cerrado, `RepetirPedido`, buscador (ya no sticky). Con búsqueda, se muestran los resultados con `TarjetaProducto`/`TarjetaCombo` en lugar de grilla o lista.
- Lista: `CarruselCategorias` + secciones en `grid gap-4 sm:grid-cols-2`, título `font-display text-4xl`, `Bajada`, y antes de cada sección menos la primera un separador "Sigue: {nombre}". El `IntersectionObserver` actual marca la activa (solo en modo lista).
- Fondo: capa `aria-hidden pointer-events-none fixed inset-0` con dos `portada-luz` (`--portada-acento: accent`), contenido en `relative`.
- Barra del pedido: igual, con `shadow-[0_12px_30px_-8px]` del acento y `font-display` en el total.
- Borrar los componentes viejos que quedaron sin uso.

### Task 5: Verificación y documentación

- [ ] `~/.bun/bin/bun.exe test` (todos), `bun x tsc --noEmit`, `bun x eslint` sobre los archivos tocados.
- [ ] En `bun run dev` (8081) con la empresa Demo: `/p/demo/<sucursal>` y `/m/<token>`; grilla → categoría → scroll a la siguiente → carrusel marca → "‹" y "atrás" del navegador vuelven a la grilla; agregar/quitar; pan; combo a elección; búsqueda; `?ver=1`; cerrado; sin fotos; ancho de celular.
- [ ] `code-reviewer` sobre el diff.
- [ ] CLAUDE.md: reemplazar "one scrolling list with sticky category chips" por la grilla + lista con carrusel.
