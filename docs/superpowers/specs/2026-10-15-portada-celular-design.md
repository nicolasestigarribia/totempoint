# Portada del tótem en el celular (online y mesa)

Fecha: 2026-10-15. Maqueta elegida: "2 · Primero Pedir, después cómo" (`.superpowers/brainstorm/.../portada-online.html`).

## Objetivo

Una sola pantalla de inicio para los tres canales. Online (`/p/$empresa`) y mesa (`/m/$token`) arrancan con la
portada del tótem adaptada al teléfono, cargada desde la sección Portada del panel. Reemplaza la portada
online actual (Envío / Retiro / Menú + lista). El menú que sigue es el que ya existe (`MenuOnline`: grilla de
categorías, menú continuo "Sigue: …", carrusel pegado). El tótem no cambia.

## Pantalla (de arriba abajo)

- Foto de portada (`heroImageUrl`) arriba, con el degradé hacia el fondo y la animación `respira`. Sin foto:
  fondo con el color de la marca.
- Online: pastilla de estado sobre la foto, "Abierto · hasta las 20:00" / "Cerrado · abre hoy a las 19:00"
  (`estadoHorario`; abierta si alguna sucursal lo está). Sin horario cargado no se muestra.
- Logo + eyebrow + nombre (`Logo` del tótem), título y acento (`Title`), subtítulo, chips (`Badges`).
  Online suma un chip automático según lo que ofrece la empresa: "Envío y retiro", "Envío a domicilio" o
  "Retiro en el local".
- Mesa: recuadro "Estás en la mesa N — Pedí desde acá y te lo llevamos…" sobre el botón.
- Botón Pedir al pie, al alcance del pulgar, con `ctaLabel` y el halo que late (`StartButton`).
- Online: debajo, link chico "Solo quiero ver el menú".
- Motas de fondo (`TotemMotas`).

## Componentes

- `src/components/totem/portada-partes.tsx` (nuevo): `Logo`, `Title`, `Badges` y el estilo del botón, sacados
  de `TotemHome.tsx` sin cambiar su aspecto. `TotemHome` los importa de ahí.
- `src/components/online/PortadaCelular.tsx` (nuevo): la pantalla de arriba. Props: datos de portada,
  `estado` opcional (pastilla), `abajo` (slot del canal: recuadro de mesa o nada), `onPedir`, `onSoloVer`
  opcional. No sabe de rutas.
- `src/components/online/HojaPedir.tsx` (nuevo, online): la hoja que sube al tocar Pedir, con el `Drawer`
  de `components/ui` (nunca popups nativos). Pasos:
  1. ¿Envío o Retiro? — se saltea si la empresa ofrece uno solo.
  2. Envío: dirección con `BuscadorDireccion` (o "Usar mi ubicación").
  3. Sucursal: la lista actual (`FilaSucursal`, abiertas primero, cerradas deshabilitadas con cuándo
     abren, distancia y costo en envío). Con una sola sucursal y retiro no se muestra: va directo.
  - Al elegir: `llevarCarrito` + `guardarEleccion` + navegar, igual que hoy.
  - "Solo quiero ver el menú": con una sucursal abre su menú con `?ver=1`; con varias, la hoja pregunta cuál.

## Datos

- `getOnlineEmpresa` y `getMesaMenu` suman los campos de portada de `totem_settings`: `heroImageUrl`,
  `eyebrow`, `title`, `titleAccent`, `subtitle`, `badge1`, `badge2`, `ctaLabel`. Sin fila o sin título: el
  título es el nombre de la empresa y el botón dice "Pedir".
- Se reutiliza el tipo de datos de `TotemHome` donde se pueda para no duplicar el mapeo.

## Rutas

- `p.$empresa.index.tsx`: queda como cargador + `PortadaCelular` + `HojaPedir`. Se borra la portada vieja
  (cinta, pasos, `BotonModo`, luces). Las clases `portada-*` de `styles.css` **se quedan**: las usa
  `MenuOnline`.
- `m.$token.index.tsx`: muestra `PortadaCelular` antes de `MenuOnline`, en la misma ruta. Pedir la cierra y
  se recuerda en `sessionStorage` por token (volver del carrito no la repite). El logo del menú vuelve a ella.
- Sin cambios: `/p/$empresa/$local` y su alias corto siguen yendo directo al menú (ya dicen la sucursal);
  el tótem.

## Panel

- Sección Portada: foto y textos visibles para toda empresa (hoy se ocultan sin módulo tótem). Plantilla y
  vista previa 1280×800 siguen siendo solo del tótem. Se suma una vista previa de teléfono (iframe ~390×800)
  con `PortadaCelular`, sin navegar.

## Fuera de alcance

- Portada en el link de una sucursal. Plantillas distintas en el teléfono (una sola disposición vertical).
- Carrito y seguimiento (partes 2 y 3 del rediseño).

## Verificación

- `tsc --noEmit`, eslint de los archivos tocados, `bun test`, `bun run build`.
- Chrome headless a 390×844 y escritorio: online con una y con varias sucursales (envío, retiro, solo
  mirar, sucursal cerrada), mesa (portada → grilla → carrito → vuelve sin portada), sin foto de portada.
- La vista previa del panel no navega.
