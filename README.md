# Totempoint

Tótems de autoservicio para casas de comida. El cliente arma su pedido desde una tablet en el mostrador y la comanda le llega al negocio, sin que nadie tenga que tomarla.

Es multiempresa: una sola instalación atiende a varias marcas, cada una con su catálogo, su portada y su gente.

## Cómo se organiza

**Empresa → negocios → tótems.**

- **Empresa**: la marca, por ejemplo PrimoRosas. La da de alta el superadmin y le asigna un dueño.
- **Negocio**: cada sucursal de esa empresa — PrimoRosas Cariló, PrimoRosas Mar del Plata. Los crea el dueño.
- **Tótem**: la tablet del mostrador. Se abre en `/t/<slug>` y no pide ningún login: es una URL pública que el negocio deja abierta. El enlace que el panel entrega para la tablet termina en `?totem=1`, y con eso el dispositivo queda marcado: cada vez que vuelve a la portada cierra cualquier sesión del panel que haya quedado abierta ahí.

## Quién puede qué

| Rol            | Alcance                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Superadmin** | El equipo de desarrollo. Ve todas las empresas y cuánto factura cada una, las da de alta y puede entrar al panel de cualquiera. |
| **Owner**      | El dueño de una empresa. Maneja marca, portada, negocios, catálogo y operadores.                                                |
| **Encargado**  | Lo da de alta el dueño. Ve únicamente los negocios que le asignaron.                                                            |

Las reglas de negocio completas están en el PDF que usa el equipo como especificación; `CLAUDE.md` documenta la arquitectura y lo que falta.

## Correr el proyecto

El gestor de paquetes es **bun**.

```sh
bun install
bun run dev      # servidor de desarrollo en el puerto 8081
bun run build    # build de producción
bun run lint
bun run format
```

La base es MySQL en Railway; `DATABASE_URL` sale de `.env.local`. Las migraciones se aplican con scripts sueltos e idempotentes en `src/db/`, ejecutados con `bun run src/db/<script>.ts`.

Para poblar una empresa de prueba con catálogo, combos y portada:

```sh
bun run src/db/seed-primorosas.ts <slug>
```

Y para cargarle los motivos de movimiento de stock y caja, sin los cuales la sección Stock no
deja registrar nada a mano:

```sh
bun run src/db/seed-action-codes.ts <slug>
```

Hay dos empresas de demostración ya armadas, cada una con su script:
`seed-primorosas.ts` (sanguchería de miga, cálida y con recetas) y
`seed-degarage.ts` (bar de cerveza artesanal, verde sobre negro). La segunda da
de alta la empresa entera —dueño incluido— si todavía no existe, así que sirve
para ver el tótem con otra identidad sin tocar nada del panel.

## Deploy

Se construye con el `Dockerfile` y se publica en Railway desde la rama `main`, según `railway.json`.
