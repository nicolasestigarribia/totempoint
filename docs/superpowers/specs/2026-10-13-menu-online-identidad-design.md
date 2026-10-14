# Pedido online y en mesa con la identidad del tótem

Fecha: 2026-10-13. Estado: aprobado por el usuario.

## Problema

El tótem y el pedido online muestran el mismo catálogo con los mismos colores (`useTotemTheme`), pero con
dos diseños distintos: el tótem tiene fotos protagonistas, tipografía de display y animaciones; el online es
una lista de filas compactas con foto chica, el formato de PedidosYa. Parecen dos marcas. La idea no es
copiar a PedidosYa sino tener identidad propia: imágenes, efectos, algo más lindo e innovador.

## Decisiones (elegidas sobre maquetas interactivas)

- **Navegación B1**: el menú abre en una grilla de categorías con foto; al tocar una se entra a una lista
  continua de todas las categorías, que arranca en la elegida y se sigue scrolleando a las siguientes.
- **Alcance completo**: se rediseñan menú, carrito y seguimiento.
- Aplica a los dos canales que comparten pantalla: online (`/p/$empresa/$local`) y mesa (`/m/$token`).
- No cambia la portada de la empresa (`/p/$empresa`), que ya tiene su estética.

Maquetas de referencia: `.superpowers/brainstorm/60207-1791915304/content/` (`menu-online-b-v2.html`
opción B1, `alcance-carrito-seguimiento.html` opción 2). No se commitean.

## 1. Menú — `src/components/online/MenuOnline.tsx`

Dos estados dentro de la misma ruta (sin ruta nueva; el estado vive en el componente, y la categoría abierta
se refleja en el hash o en el search param para que "atrás" del navegador vuelva a la grilla).

**Grilla (al entrar)**
- Encabezado actual (`OnlineHeader` / `MesaHeader`) con logo, nombre, sucursal y pastilla Abierto/Cerrado.
- Título "¿Qué vas a **pedir**?" (acento en la palabra).
- Encima de la grilla, lo que hoy está arriba del menú y corresponda: buscador, "Repetir mi último pedido"
  (carrito vacío, solo online), aviso de cerrado, franja de envío y pagos (`InfoDelLocal`) o `InfoDeMesa`.
- Grilla de 2 columnas de tarjetas de categoría: foto de fondo, degradado, nombre en display, "N productos".
  La primera (Combos si hay, si no la primera categoría) ocupa las dos columnas. Entran escalonadas.
  Una categoría sin foto usa un fondo del color de acento.

**Lista (al tocar una categoría)**
- Botón ‹ en el encabezado que vuelve a la grilla.
- Carrusel horizontal fijo de categorías con foto (las mismas tarjetas que el carrusel del tótem, más chicas),
  que marca la categoría visible mientras se scrollea y se centra solo.
- Todas las categorías en orden, arrancando con el scroll en la elegida. Entre una y la siguiente, separador
  "Sigue: {nombre}". Título de sección en display y bajada (`Bajada`, sin repetir la misma seguida).
- **Tarjeta de producto grande** (reemplaza la fila compacta de `TarjetaMenu`): foto arriba (~180px) con el
  nombre encima sobre degradado, etiqueta "N°" para productos numerados, descripción completa (sin
  "Ver más"), selector de pan (`ElegirPan`), aviso de regalo y "le podés sacar o agregar cosas", precio en
  display con color de acento, botón "+ Agregar" que se convierte en − cantidad + (🗑 en 1).
  Seleccionada con borde de acento cuando ya está en el carrito.
- Combos con la misma tarjeta; los combos a elección abren `ElegirGustos` dentro de la tarjeta, como hoy.
- Al agregar: "+1" que sube desde el botón y la barra "Ver mi pedido" late.
- Buscando: los resultados se muestran con la misma tarjeta grande (reemplaza la lista).

**Comunes**
- Fondo con luces del color de marca (reusar las clases `portada-*` de `styles.css`).
- Modo "Solo mirar" (`SoloVer`): sin agregar, sin pan, sin repetir, sin barra; igual que hoy.
- Todas las animaciones bajo `prefers-reduced-motion`.
- Fotos con `loading="lazy"`; el carrusel fijo sin `backdrop-filter` ni sombras pesadas (el tótem ya
  aprendió que un elemento sticky con muchas fotos traba el teléfono).

## 2. Carrito — `p.$empresa.$local.carrito.tsx`, `m.$token.carrito.tsx`, `CarritoPartes.tsx`

- Título "Tu **pedido**" y bajada "N productos · {sucursal}".
- `LineasCarrito`: cada línea es una franja con la foto de fondo y degradado lateral; nombre en display,
  precio unitario, todo lo que muestra hoy (pan, sacados, extras, gustos, "Cambiar", agotado tachado),
  − / + sobre fondo esmerilado, subtotal de línea en display con acento. Sin foto: fondo de tarjeta.
- `Bloque` pasa a llevar número de paso (1, 2, 3…) en una insignia de acento; el número se calcula según
  los bloques visibles (en mesa no hay "¿Cómo lo querés?").
- `Opcion` (envío/retiro, medio de pago): tarjeta alta con ícono, título en display y aclaración
  (tiempo estimado, "al recibir", "pagás al mozo"); seleccionada con borde y degradado de acento.
- Inputs con borde de 2px y fondo de tarjeta. Mapa y buscador de dirección sin cambios de funcionamiento.
- Totales como ticket: borde punteado, total en display grande con acento.
- Botón de enviar más alto, en display, con latido suave.

## 3. Seguimiento — `p.$empresa.$local.pedido.$token.tsx`, `m.$token.pedido.$tracking.tsx`

- Cabecera con la foto del primer producto (efecto Ken Burns lento), "Pedido N° X", estado en display
  grande y texto de ayuda; anillo de progreso (conic-gradient) con el ícono del estado.
  Sin foto: fondo de acento con las luces.
- Línea de tiempo vertical con los pasos; el actual con pulso, los pasados atenuados.
  Online: Enviado → Confirmado → Preparando → Listo/Entregado. Mesa: Recibido → Preparando → ¡Te lo llevamos!
- "Lo que pediste": carrusel de miniaturas con foto, cantidad y nombre, y el total.
- Se conserva todo lo funcional: cancelar y cambiar medio de pago antes de la aceptación
  (`AccionesPedido`), botón Pagar de Mercado Pago, estado cancelado, "Pedir algo más", refresco automático.
  Requiere que `getOnlineOrder` / `getMesaOrder` devuelvan la foto de cada ítem: hoy `order_items` congela
  nombre y precio; la foto se toma del producto o combo actual (`photo_url`), y si ya no existe, sin foto.

## Lo que no cambia

Server functions de pedido, `tomarPedido`, carrito (`totem-cart.ts`), precios, validaciones, polling,
Mercado Pago. El único cambio de servidor es sumar la foto de los ítems en las dos funciones de seguimiento.

## Estructura

- Piezas visuales nuevas en `src/components/online/` (p. ej. `GrillaCategorias`, `CarruselCategorias`,
  `TarjetaProducto`, `CabeceraSeguimiento`, `LineaDeTiempo`), usadas por ambos canales. `MenuOnline.tsx`
  tiene 1055 líneas: la tarjeta y la búsqueda salen a sus archivos en vez de crecer ahí.
- Animaciones nuevas en `styles.css` junto a `aparece`/`latido`/`portada-*`, con el mismo bloque de
  `prefers-reduced-motion`.

## Orden de trabajo y verificación

1. Menú → probar en `bun run dev` con la empresa Demo (online y mesa), con y sin fotos, buscando, en
   "Solo mirar", con categorías largas, en un celular real o el emulador de Chrome.
2. Carrito → pedido completo con envío, retiro y mesa; efectivo y Mercado Pago de prueba.
3. Seguimiento → avanzar el pedido desde la comanda y ver cada estado; cancelado; mesa.
4. `bun run lint` en lo tocado, `bun run test`, y `code-reviewer` sobre el diff.
