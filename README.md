# Burger Point Order

Quiero crear una app web responsive para una hamburguesería, pensada para usarse en una tablet/tótem de autoservicio tipo McDonald’s.

El objetivo es que el cliente pueda hacer un pedido desde la pantalla sin ayuda de un mozo.

Necesito una demo funcional, moderna y visualmente atractiva.

Pantallas necesarias:

Pantalla de inicio  

Logo ficticio: “Burger Point”

Botón grande: “Empezar pedido”

Diseño moderno, estilo fast food premium

Fondo atractivo con hamburguesas

Pantalla de categorías
Categorías:

Hamburguesas

Papas

Bebidas

Postres

Combos

Cada categoría debe verse como una tarjeta grande con imagen.

Pantalla de productos
Cada producto debe mostrar:

Imagen

Nombre

Descripción corta

Precio

Botón “Agregar”

Productos de ejemplo:

Hamburguesas:

Classic Burger — Hamburguesa simple con cheddar, lechuga y salsa especial — $8500

Double Smash — Doble carne, doble cheddar, cebolla y salsa house — $11500

Bacon Burger — Carne, cheddar, panceta crocante y barbacoa — $12500

Papas:

Papas clásicas — $4500

Papas con cheddar y bacon — $6500

Bebidas:

Coca-Cola — $3000

Agua — $2500

Cerveza artesanal — $5000

Postres:

Brownie con helado — $6000

Chocotorta — $5500

Combos:

Combo Classic: Classic Burger + papas + bebida — $14500

Combo Double: Double Smash + papas + bebida — $17500

Carrito
El carrito debe mostrar:

Productos agregados

Cantidad

Botón + y -

Subtotal

Total

Botón “Confirmar pedido”

Pantalla de confirmación
Antes de enviar el pedido, pedir:

Nombre del cliente

Método de entrega:

Comer en el local

Retirar en mostrador

Comentarios opcionales

Botón final:

“Enviar pedido”

Pantalla de pedido confirmado
Mostrar:

“Pedido enviado con éxito”

Número de orden automático, por ejemplo #104

Mensaje: “Te avisaremos cuando esté listo”

Botón “Nuevo pedido”

Panel de cocina / administración
Crear una ruta o pantalla separada llamada “Panel de cocina”.

Debe mostrar:

Pedidos recibidos

Número de orden

Nombre del cliente

Productos pedidos

Total

Comentarios

Estado del pedido

Estados:

Nuevo

En preparación

Listo

Entregado

Debe permitir cambiar el estado del pedido con botones.

Requisitos de diseño:

UI moderna, limpia y premium

Botones grandes, aptos para pantalla táctil

Diseño responsive para tablet

Colores estilo hamburguesería moderna: negro, blanco, rojo oscuro, amarillo/dorado

Tipografía grande y clara

Animaciones suaves

Que parezca un producto real, no una maqueta básica

Requisitos técnicos:

Usar datos mockeados/locales al principio

Que los pedidos se guarden al menos durante la sesión

No integrar pagos todavía

No integrar impresora todavía

No crear login por ahora

No agregar funciones innecesarias

Priorizar que la demo sea linda, simple y usable

Importante:
Quiero que primero construyas el MVP completo con estas pantallas y flujo funcionando de punta a punta. Después vamos a iterar mejoras.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d3d2d7ad-f5e5-4048-9a03-9d923ab9d5fd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitLab and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
