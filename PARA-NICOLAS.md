# Briefing de trabajo — Totempoint

Este archivo es para quien retome el desarrollo (y para su asistente de IA). Dice tres cosas:
qué **no** hay que tocar, por qué, y qué **sí** falta hacer.

Leelo entero antes de escribir código. `CLAUDE.md` tiene el detalle de la arquitectura; esto es
lo que se rompe si no lo sabés.

---

## Parte 1 — Reglas que no se cambian

Cada una de estas está así por una razón concreta, casi siempre porque ya falló de la otra forma.
Si te parece que alguna sobra, preguntá antes de sacarla.

### Plata y pedidos

**Los precios se recalculan en el servidor, siempre.** El tótem manda qué productos y cuántos, nunca
cuánto salen. `createTotemOrder` busca los precios en la base y arma el total ahí. Si alguna vez un
precio viaja desde el cliente, cualquiera con la consola del navegador abierta se hace un combo a
$1.

**`order_items` congela el nombre y el precio del producto.** Editar un producto no puede reescribir
pedidos viejos: lo que se vendió ayer a $2.000 tiene que seguir diciendo $2.000 para siempre.

**La numeración de pedidos reinicia en 1 cada mañana, por local.** Por eso `orders.business_date` se
guarda y no se deriva de `created_at`, y por eso la clave única es
`(location_id, business_date, order_number)`. La jornada es un hecho del negocio, no una hora: dos
tótems con el reloj corrido arrancarían días distintos. El id interno autoincremental es el que
nunca se repite.

**Cancelar un pedido es su propia función, no un cambio de estado.** `cancelOrder` decide qué pasa
con la plata ya cobrada: si estaba pagado queda en `reembolso_pendiente`, porque la devolución es a
mano. Un pedido cancelado **no vuelve atrás** — si el cliente se arrepiente se toma uno nuevo. Eso
es a propósito: si se pudiera revivir, el cierre de caja de un día cambiaría después de cerrado.

**Un pago de Mercado Pago no se marca a mano.** La cocina le pregunta a Mercado Pago por los pedidos
de Mercado Pago que siguen pendientes, y al tocar "Esperando pago" también. Si Mercado Pago no lo
tiene, el pedido pasa a **efectivo** (el cliente pagó en la caja): el total de Mercado Pago del
cierre tiene que coincidir con la cuenta, y el de efectivo con el cajón. Un cobro que confirmó
Mercado Pago no se puede desmarcar; si hay que devolverlo, se cancela.

**Los cambios críticos se auditan.** Permisos, precios, cobros, cancelaciones, sucursales y tótems
dejan una fila en `audit_log` con `registrarAuditoria`. Si agregás una mutación de ese tipo, sumale
su entrada. Nunca guardes ahí un secreto (el token de Mercado Pago, una contraseña).

**El cierre de caja cuenta solo lo que alguien marcó como cobrado.** No lo que se pidió. Esa es la
cifra que se compara contra la caja física.

### Mercado Pago

**Cada empresa cobra en su propia cuenta.** El access token vive en `payment_settings`, una tabla
aparte de `companies` justamente para que sea difícil devolverlo por accidente junto con los datos
de marca. **El token nunca sale del servidor**: al tótem solo le llega un booleano diciendo si
ofrece el botón o no.

**El pedido se guarda ANTES de pedirle la preferencia a Mercado Pago.** Si Mercado Pago está caído,
el pedido igual queda tomado y el mostrador lo cobra en efectivo. No se pierde una venta porque la
API de un tercero tuvo un mal día.

**El webhook toma únicamente el id del pago** del aviso, nunca si está aprobado ni por cuánto. Eso
se le pregunta a Mercado Pago con el token de la empresa. `/api/mp/webhook` es público: cualquiera
puede golpearlo diciendo que un pedido se pagó. Además se verifica que el pedido sea de la empresa
cuyo token reconoció el pago.

**El tótem también pregunta por su cuenta cada 3 segundos mientras el cliente paga.** Eso no es un
parche de desarrollo: los avisos se pierden también en producción, y hay alguien parado frente a la
pantalla esperando que avance.

### Accesos

**Toda mutación verifica el permiso, no solo la empresa.** `requireCompany` responde "¿sos de esta
empresa?", jamás "¿te dejaron hacer esto?". Ya pasó dos veces que faltara: un encargado con Stock en
*solo ver* podía cargar movimientos, y cualquiera podía avanzar pedidos en la comandera. Usá
`requireEdit(seccion)` o un `canEdit` explícito.

**La comandera no se rige solo por la matriz de permisos.** El rol `kitchen` existe para trabajar
ahí y no tiene secciones tildadas. Esa regla vive en `assertCanViewKitchen` /
`assertCanOperateKitchen` en `src/lib/auth/scope.ts`.

**Un encargado ve solo los negocios que le asignaron.** `accessibleLocationIds` y
`assertLocationAccess` en `scope.ts` son el único lugar que decide eso. No lo repliques en otro lado.

**Cambiar una contraseña o desactivar a alguien cierra sus sesiones abiertas.** Si no, resetear la
clave de quien se fue de la empresa no hace nada hasta que su sesión venza sola.

### Trampas técnicas que ya costaron tiempo

**Nunca exportes una función común que toque la base desde un archivo `*.functions.ts`.** Solo las
server functions se sacan del bundle del cliente. Una función normal exportada ahí se queda, se
lleva puestos a drizzle y al driver de MySQL al navegador, y **la app entera se queda sin
JavaScript** — sin errores de compilación, solo páginas en blanco. Por eso `acreditarPedido` vive en
`src/lib/payments/acreditar.ts`.

**Los errores del `inputValidator` llegan como el JSON crudo de zod.** Mostralos con
`mensajeDeError` (`src/lib/error-message.ts`), no con `err.message`, o el usuario ve un array de
objetos en pantalla.

**`window.confirm` no sirve en el tótem ni en la comandera.** Esas pantallas viven en tablets en
modo kiosco, donde el cartel del navegador a veces ni aparece. Usá un diálogo propio.

**`movements` es append-only.** `artistock.stockActual` es una columna generada por MySQL: no se
escribe, se insertan movimientos y los acumulados siguen solos.

**`src/routeTree.gen.ts` se genera solo.** No lo edites a mano. Si agregás una ruta y el dev server
empieza a tirar errores raros de `routesById`, reinicialo.

### Vocabulario

Una **empresa** es el tenant (`companies`), un **negocio** es una sucursal (`locations`). En la base
las tablas quedaron con los nombres viejos, pero en pantalla y en los mensajes es empresa y negocio.
Nunca "local" ni "negocio" para el tenant.

El producto se llama **Totempoint**. "Burger Point" era el demo original y está borrado: no lo
reintroduzcas en textos ni en títulos.

---

## Parte 2 — Lo que falta

### Ya está hecho pero sin subir

**Precios por local y auditoría de cambios de precio** (punto 6 del PDF). Están desarrollados pero
no llegaron a `develop`. Subilo cuanto antes: el resto del sistema se movió bastante y el merge se
complica solo.

Cuando lo subas, revisá que la auditoría guarde producto o combo, precio anterior y nuevo, quién lo
hizo, en qué local y cuándo, y que el ajuste por porcentaje (+10% / −5%) se pueda aplicar sobre
varios a la vez.

### Bugs visibles

Los dos que estaban acá —la disponibilidad por local que el tótem ignoraba y el tótem que no sabía
a qué local pertenecía— están resueltos: la URL del tótem es `/t/{empresa}/{local}/{tótem}`, de ahí
sale el local, y tanto `getTotemMenu` como `createTotemOrder` aplican los overrides de ese local.
El pedido también, y no sólo el menú: el carrito vive en la tablet y sobrevive a que alguien apague
un producto desde el panel.

**Los combos ya tienen disponibilidad por sucursal.** La sección Disponibilidad tiene su tabla y su
interruptor, que escribe en `location_combos`. Además —y esto no se guarda en ninguna tabla— un
combo se cae solo en la sucursal que tenga apagado alguno de los productos que lleva adentro: sin
el componente no hay con qué armarlo. Si lo guardáramos habría que acordarse de apagar a mano cada
combo cada vez que se apaga un producto, y el día que alguien se olvide el cliente compra algo que
el mostrador no puede entregar. La columna "Motivo" de esa tabla dice cuál es el producto que
falta, para que un combo oculto nunca sea un misterio.

### Del PDF, sin empezar

**Productos propios de un local** (punto 5). Hoy el catálogo es de la empresa; una sucursal no puede
tener algo exclusivo ni elegir qué hereda.

**Personalización por producto** (punto 7). Hecho. El dueño enciende "el cliente puede sacarle
ingredientes" en cada producto y marca cuáles se pueden sacar; el tótem ofrece sólo eso y el
servidor lo revalida contra la receta. No cambia el precio. Lo que se sacó queda congelado por
línea en `order_item_removals` y la comanda lo imprime debajo del producto.

**La venta descuenta stock.** Antes no: el código `VENTA` estaba marcado como automático y no lo
usaba nadie, así que `vp_local` era siempre cero. Ahora `src/lib/stock/venta.ts` descuenta **al
tomar el pedido**, y cancelar devuelve exactamente lo que ese pedido había sacado (revierte sus
propios movimientos, no recalcula la receta, que pudo cambiar). Una línea de receta sin cantidad no
descuenta nada: inventar un número ahí ensucia el inventario sin que nadie se entere.

### Tickets impresos — lo nuevo

Tienen que salir **dos tickets en papel**, distintos entre sí.

**El del cliente:** nombre del local, número de pedido bien grande, **código de verificación**, fecha
y hora, detalle de lo que pidió, total, y si ya está pagado o paga en la caja.

**La comanda del local:** el mismo número y el mismo código, la hora, el detalle para preparar, y el
estado de cobro destacado, para que nadie entregue algo sin cobrar.

**El código de verificación es el punto importante.** Son 4 caracteres aleatorios por pedido,
guardados en `orders`. Como la numeración reinicia en 1 todos los días, sin código cualquiera se
acerca al mostrador y dice "soy el pedido 3" y se lleva algo que no pagó — sobre todo donde no se ve
qué hizo el cliente en el tótem. Tiene que ser **aleatorio**: si se derivara del número de pedido,
alguien lo calcularía.

**Restricción técnica que define el diseño:** un navegador no puede mandarle comandos a una
impresora térmica, y el servidor está en Railway y no llega a la red del local. El camino simple es
generar el ticket como una página de 80 mm y usar la impresión del navegador, con Chrome en modo
kiosco (`--kiosk-printing`) para que salga sin diálogo. Después, si hace falta más control, se puede
agregar un agente local que hable ESC/POS, sin rehacer el contenido del ticket.

**La comanda tiene que imprimirse sola al entrar el pedido**, no con alguien apretando un botón. Eso
implica que la pantalla de cocina quede siempre abierta en la máquina que tiene la impresora.

### Decisión pendiente del dueño del producto

**¿Quién mueve los estados de los pedidos en la cocina?** Para que "Recibido → En preparación →
Entregado" sirva, alguien en la cocina real del negocio tiene que tener la comandera abierta y
tocarla. Si nadie lo va a hacer, los estados no aportan y conviene simplificar (ver el punto de
abajo sobre los dos estados). Hay que preguntárselo al cliente antes de tocar nada. La comandera
ya no tiene "Mi cuenta" ni "Salir": quien entra desde el panel vuelve con el botón "Panel", y el
usuario de cocina no tiene otra pantalla.

El PDF (punto 9) pide **dos estados**: Pendiente y Entregado. El sistema hoy tiene `recibido`,
`preparacion`, `entregado` y `cancelado`. Está funcionando y en uso, así que no se tocó. Hay que
definirlo antes de que alguien lo cambie por su cuenta.

---

## Parte 3 — Antes de dar algo por terminado

- `bunx tsc --noEmit` limpio.
- `bun run test` en verde (son los tests de permisos, que es lo que falla en silencio).
- `bunx eslint` sin errores **en los archivos que tocaste**. Hay ~320 errores de formato
  preexistentes en archivos que nadie tocó: no corras `bun run format` sobre todo el repo sin
  avisar, reescribe media base de código y hace imposible el merge.
- Probalo en el navegador de verdad, no solo que compile. Varios de los bugs de esta semana
  compilaban perfecto.
- Las migraciones son scripts sueltos e idempotentes en `src/db/`, se corren con
  `bun run src/db/<script>.ts`. `DATABASE_URL` sale de `.env.local` y **apunta a la base de
  producción**: lo que corras, corre en producción.
