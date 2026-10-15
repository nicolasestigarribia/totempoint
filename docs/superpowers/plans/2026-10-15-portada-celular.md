# Portada del tótem en el celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Online (`/p/$empresa`) y mesa (`/m/$token`) arrancan con la portada del tótem adaptada al teléfono; en online, Pedir abre una hoja que pregunta envío/retiro, dirección y sucursal.

**Architecture:** Las piezas visuales de `TotemHome` (logo, título, chips, botón) pasan a `portada-partes.tsx` y las comparten el tótem y el nuevo `PortadaCelular`. Los datos salen de `totem_settings` con un helper (`portadaDe`) que suman `getOnlineEmpresa` y `getMesaMenu`. La lógica de elegir sucursal de `p.$empresa.index.tsx` se muda a `HojaPedir` (Drawer de vaul).

**Tech Stack:** TanStack Start, React 19, Tailwind 4, Drizzle/MySQL, vaul, bun.

Spec: `docs/superpowers/specs/2026-10-15-portada-celular-design.md`.

## Global Constraints

- Nunca popups nativos (`window.confirm/alert/prompt`).
- UI en español, "sucursal" en femenino; código e identificadores como el código vecino (español en este repo).
- No cambia el aspecto del tótem.
- Las clases `portada-*` de `styles.css` se quedan (las usa `MenuOnline`).
- El link de una sucursal (`/p/$empresa/$local`, alias corto) sigue yendo directo al menú.
- No commitear sin pedido del usuario.

## File Structure

- Create `src/components/totem/portada-partes.tsx` — `Logo`, `Title`, `Badges`, `claseBoton`, `estiloBoton`, `ContenidoBoton`, tipo `PortadaDatos` re-exportado.
- Modify `src/components/totem/TotemHome.tsx` — importa las partes.
- Modify `src/lib/api/totem.functions.ts` — `PortadaDatos`, `portadaDe()`, `cargarPortada()`, campo `portada` en `OnlineEmpresa` y `MesaMenu`.
- Create `src/components/online/PortadaCelular.tsx` — la pantalla.
- Create `src/components/online/HojaPedir.tsx` — la hoja de online + `FilaSucursal` (movida).
- Modify `src/routes/p.$empresa.index.tsx` — portada nueva + hoja; borra la vieja.
- Modify `src/routes/m.$token.index.tsx`, `src/components/online/MenuOnline.tsx`, `src/components/mesa/MesaHeader.tsx` — portada en mesa, logo vuelve.
- Modify `src/components/admin/PortadaSection.tsx` — textos/foto para todos, vista previa de teléfono.
- Modify `src/styles.css` — borrar clases que queden sin uso (`portada-anillo`, `marquesina*` si nadie más las usa).
- Modify `CLAUDE.md` — documentar.

### Task 1: Datos de portada en el servidor

**Interfaces — Produces:**
```ts
export type PortadaDatos = Pick<TotemHome, "name" | "logoUrl" | "primaryColor" | "accentColor" |
  "heroImageUrl" | "eyebrow" | "title" | "titleAccent" | "subtitle" | "ctaLabel" | "badge1" | "badge2">;
function portadaDe(company: typeof companies.$inferSelect, s: typeof totemSettings.$inferSelect | null): PortadaDatos;
async function cargarPortada(companyId: number): Promise<PortadaDatos>;
// OnlineEmpresa.portada: PortadaDatos;  MesaMenu.portada: PortadaDatos
```
- [ ] `getTotemHome` usa `portadaDe` para los mismos campos (title cae al nombre, ctaLabel a "Empezar pedido").
- [ ] `getOnlineEmpresa` selecciona la fila entera de `totemSettings` y devuelve `portada`.
- [ ] `getMesaMenu` llama `cargarPortada(r.company.id)`.
- [ ] `tsc --noEmit`.

### Task 2: Partes compartidas + PortadaCelular

- [ ] Mover `Logo`, `Title`, `Badges` (con prop `extra?: string[]`) y el estilo del botón a `portada-partes.tsx`, tipados con `PortadaDatos`. `TotemHome` los importa; `StartButton` usa `claseBoton`/`estiloBoton`/`ContenidoBoton`.
- [ ] `PortadaCelular({ datos, estado?, chips?, aviso?, onPedir, onSoloVer? })`:
  foto 40svh con `respira` y degradé (sin foto: color de la marca), pastilla de estado arriba a la izquierda,
  `TotemMotas`, cuerpo `-mt-16` con Logo, Title `text-6xl`, bajada, Badges + chips, aviso, botón al pie
  (`mt-auto`), link "Solo quiero ver el menú".
- [ ] tsc + eslint; tótem headless a 1852×893 igual que antes.

### Task 3: Online — portada + HojaPedir

- [ ] `HojaPedir({ empresa, abierta, inicio: "pedir" | "ver", onCerrar })`: pasos `como` → `direccion` → `sucursal`, o `ver`.
  Mueve `opcionesEnvio`, `elegir`, `verMenu`, `FilaSucursal` desde la ruta. `Drawer shouldScaleBackground={false}`.
- [ ] Ruta: `PortadaCelular` con estado de horario (abierta si alguna; "Abierto · hasta las 20:00" / "Cerrado · abre …"; oculta sin horarios), chip automático ("Envío y retiro" / "Envío a domicilio" / "Retiro en el local").
  Pedir: retiro único con una sola sucursal → `elegir` directo; si no, abre la hoja. Solo ver: una sucursal → `verMenu`; si no, hoja en `ver`.
- [ ] Borrar `BotonModo`, cinta, pasos y luces de la ruta.
- [ ] Headless 390×844: una sucursal (NastyMondays) y varias.

### Task 4: Mesa

- [ ] `m.$token.index.tsx`: estado `enPortada`; inicial `!vistas.has(token)` (Set de módulo); en `useEffect`, si `sessionStorage["mesa-portada:"+token]` o hay hash → `false`. Pedir: marca, oculta, scroll arriba.
- [ ] Aviso "Estás en la mesa N" + "Pedí desde acá y te lo llevamos. Pagás con Mercado Pago o en efectivo al mozo." (según `mercadoPago`/`cash`).
- [ ] `CanalMenu` mesa suma `onInicio?: () => void`; `MesaHeader` hace del logo un botón que la llama.
- [ ] Headless: portada → grilla → carrito → atrás sin portada; logo → portada.

### Task 5: Panel

- [ ] `PortadaSection`: foto y textos fuera de `conTotem`; plantilla queda dentro. Encabezado "Pantalla de inicio · tótem, pedido online y mesa".
- [ ] Vista previa de teléfono: `PreviewFrame width={390} height={800}` en una caja `max-w-[300px]`, con `themeVars` y `PortadaCelular` sin acciones. La del tótem sigue solo con módulo.
- [ ] Headless del panel: no navega.

### Task 6: Cierre

- [ ] Borrar CSS sin uso; CLAUDE.md (sección online: la portada; mesa: portada).
- [ ] `tsc`, eslint de los tocados, `bun test`, `bun run build`; code-reviewer sobre el diff.
