/**
 * El índice del buscador del panel: cada cosa que alguien puede querer
 * configurar, con las palabras con que la buscaría ("delivery", "km",
 * "contraseña de la cocina"), y a dónde lleva (`seccion` o `seccion:pestaña`,
 * o una pantalla aparte como la comandera).
 *
 * Es puro y sin React para poder probarlo: quien no conoce el sistema no sabe
 * que el costo del envío está en "Pedido online → Retiro y envío".
 */

export interface DestinoBusqueda {
  titulo: string;
  /** Dónde está, en palabras: "Pedido online → Horario". */
  donde: string;
  /** `seccion`, `seccion:pestaña`, o una ruta que empieza con "/". */
  ir: string;
  claves: string;
}

export const DESTINOS: DestinoBusqueda[] = [
  // Ventas
  {
    titulo: "Comandera",
    donde: "Pantalla de pedidos",
    ir: "/kitchen",
    claves: "pedidos cocina aceptar entregar comanda",
  },
  {
    titulo: "Imprimir comandas",
    donde: "Comandera → Imprimir solo",
    ir: "/kitchen",
    claves: "impresora ticket papel termica imprimir comanda",
  },
  {
    titulo: "Ventas y caja",
    donde: "Ventas y caja",
    ir: "caja",
    claves: "cierre caja recaudacion cuanto vendi ventas efectivo cobrado",
  },
  {
    titulo: "Descargar planilla de pedidos",
    donde: "Ventas y caja → Descargar planilla",
    ir: "caja",
    claves: "excel csv exportar contador planilla",
  },
  {
    titulo: "Lo más vendido",
    donde: "Ventas y caja",
    ir: "caja",
    claves: "ranking mas vendidos productos estrella",
  },
  // Menú
  {
    titulo: "Productos",
    donde: "Menú → Productos",
    ir: "productos",
    claves: "producto precio foto agregar plato menu carta",
  },
  {
    titulo: "Tamaños (grande, chica)",
    donde: "Productos → abrir un producto",
    ir: "productos",
    claves: "tamano grande chica mediana porcion",
  },
  {
    titulo: "Pausar un producto",
    donde: "Productos → “A la venta”",
    ir: "productos",
    claves: "pausar ocultar dejar de vender sin stock apagar",
  },
  {
    titulo: "Categorías",
    donde: "Menú → Categorías",
    ir: "categorias",
    claves: "categoria seccion orden del menu rubros",
  },
  {
    titulo: "Pizza mitad y mitad",
    donde: "Categorías → abrir una categoría",
    ir: "categorias",
    claves: "mitad dos gustos 2 gustos media pizza combinar",
  },
  {
    titulo: "Regalo “cada 12, 2 gratis”",
    donde: "Categorías → abrir una categoría",
    ir: "categorias",
    claves: "regalo promo gratis docena bonificacion",
  },
  {
    titulo: "Combos y promos",
    donde: "Menú → Combos",
    ir: "combos",
    claves: "combo promo promocion oferta elegir gustos empanadas docena",
  },
  {
    titulo: "Sacar o agregar ingredientes",
    donde: "Avanzado → Ingredientes",
    ir: "ingredientes",
    claves: "sin cebolla extra agregado ingrediente receta personalizar",
  },
  // Canales
  {
    titulo: "Link y QR para vender",
    donde: "Pedido online → Link y QR",
    ir: "online:links",
    claves: "link qr compartir instagram alias direccion web",
  },
  {
    titulo: "Abrir o cerrar los pedidos online",
    donde: "Pedido online",
    ir: "online",
    claves: "abrir cerrar pausar tomar pedidos ahora",
  },
  {
    titulo: "Horario de atención",
    donde: "Pedido online → Horario",
    ir: "online:horario",
    claves: "horario hora abre cierra turnos dias feriado",
  },
  {
    titulo: "Envío a domicilio",
    donde: "Pedido online → Retiro y envío",
    ir: "online:entrega",
    claves: "envio delivery domicilio km kilometros costo de envio reparto retiro",
  },
  {
    titulo: "Pedido mínimo",
    donde: "Pedido online → Cobro y mínimo",
    ir: "online:cobro",
    claves: "minimo monto minimo efectivo",
  },
  {
    titulo: "Tótems",
    donde: "Mi negocio → Tótems",
    ir: "totems",
    claves: "totem tablet autoservicio mostrador pantalla",
  },
  {
    titulo: "Salón y mesas",
    donde: "Mi negocio → Salón",
    ir: "salon",
    claves: "mesa mesas qr de mesa salon mozo",
  },
  // Mi negocio
  {
    titulo: "Colores, letras y portada",
    donde: "Mi negocio → Apariencia",
    ir: "portada",
    claves: "color colores letra fuente tipografia portada foto diseno apariencia",
  },
  {
    titulo: "Mercado Pago",
    donde: "Mi negocio → Formas de cobro",
    ir: "pagos",
    claves: "mercado pago tarjeta qr cobrar transferencia",
  },
  {
    titulo: "Nombre y logo",
    donde: "Avanzado → Datos y sucursales",
    ir: "empresa",
    claves: "logo nombre marca empresa",
  },
  {
    titulo: "WhatsApp y teléfono de la sucursal",
    donde: "Avanzado → Datos y sucursales",
    ir: "empresa",
    claves: "whatsapp telefono celular contacto direccion sucursal",
  },
  {
    titulo: "Sucursales",
    donde: "Avanzado → Datos y sucursales",
    ir: "empresa",
    claves: "sucursal local nueva sucursal",
  },
  // Avanzado
  {
    titulo: "Equipo y permisos",
    donde: "Avanzado → Equipo",
    ir: "operadores",
    claves: "usuario empleado cocina encargado permiso contrasena de la cocina",
  },
  {
    titulo: "Mi contraseña",
    donde: "Mi cuenta",
    ir: "/cuenta",
    claves: "contrasena clave password cambiar mi cuenta",
  },
  {
    titulo: "Stock",
    donde: "Avanzado → Stock",
    ir: "stock",
    claves: "stock inventario agotado mercaderia compra",
  },
  {
    titulo: "Precio distinto en una sucursal",
    donde: "Avanzado → Precios por sucursal",
    ir: "precios",
    claves: "precio sucursal aumento ajuste masivo",
  },
  {
    titulo: "Qué se vende en cada sucursal",
    donde: "Avanzado → Disponibilidad",
    ir: "disponibilidad",
    claves: "disponibilidad sucursal apagar producto",
  },
  {
    titulo: "Movimientos de stock y caja",
    donde: "Avanzado → Movimientos",
    ir: "movimientos",
    claves: "movimiento retiro de caja rotura vencido",
  },
  {
    titulo: "Quién cambió qué",
    donde: "Avanzado → Auditoría",
    ir: "auditoria",
    claves: "auditoria historial cambios registro",
  },
];

/** Minúsculas y sin tildes: "Tamaño" y "tamano" son lo mismo. */
export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Los destinos que coinciden con lo escrito, los mejores primero. Cada palabra
 * escrita tiene que aparecer (al principio de alguna palabra del título o de
 * las claves); pesa más si está en el título. `visible` deja afuera lo que el
 * usuario no puede abrir.
 */
export function buscarEnPanel(
  texto: string,
  visible: (ir: string) => boolean,
  destinos: DestinoBusqueda[] = DESTINOS,
): DestinoBusqueda[] {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const puntuados: { d: DestinoBusqueda; puntos: number }[] = [];
  for (const d of destinos) {
    if (!visible(d.ir)) continue;
    const titulo = normalizar(d.titulo).split(/[^a-z0-9]+/);
    const claves = normalizar(`${d.claves} ${d.donde}`).split(/[^a-z0-9]+/);
    let puntos = 0;
    let todas = true;
    for (const p of palabras) {
      if (titulo.some((w) => w.startsWith(p))) puntos += 3;
      else if (claves.some((w) => w.startsWith(p))) puntos += 1;
      else {
        todas = false;
        break;
      }
    }
    if (todas) puntos > 0 && puntuados.push({ d, puntos });
  }
  return puntuados.sort((a, b) => b.puntos - a.puntos).map((x) => x.d);
}
