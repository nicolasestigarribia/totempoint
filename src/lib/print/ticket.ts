/**
 * Armado del ticket en ESC/POS, el lenguaje que entienden las impresoras
 * térmicas (Epson TM, y las genéricas compatibles). Es una función pura:
 * recibe los datos del pedido y devuelve los bytes a mandar a la impresora,
 * sin saber cómo se transmiten (Bluetooth, red o USB). Así el mismo ticket
 * sirve para cualquier transporte que elijamos después.
 *
 * Pensado para papel de 58mm (32 caracteres por línea en Fuente A). Para 80mm
 * pasar `widthChars: 48`.
 *
 * Los acentos se transliteran a ASCII a propósito: cada impresora arranca en
 * una code page distinta y un "á" crudo sale como basura en muchas. Un ticket
 * no necesita tildes, y así imprime igual en cualquier modelo.
 */

import { formatearNumeroPedido } from "@/lib/order-number";

export interface TicketItem {
  name: string;
  quantity: number;
  /** Precio unitario en unidades de moneda (no centavos). */
  unitPrice: number;
  /** Lo que el cliente sacó ("sin cebolla"), para la cocina. */
  removed?: string[];
  /** Lo que agregó ("+2 carne"), con cantidad. */
  extras?: { name: string; quantity: number }[];
}

export interface TicketData {
  companyName: string;
  orderNumber: number;
  /** Jornada del pedido (`YYYY-MM-DD`), para el número visible `MMDD-NN`. */
  businessDate: string;
  customerName: string;
  createdAt: Date;
  deliveryMethod: "local" | "mostrador";
  items: TicketItem[];
  total: number;
  comments?: string | null;
  paymentMethod?: "efectivo" | "mercadopago";
  /** 32 para 58mm (default), 48 para 80mm. */
  widthChars?: number;
}

// Comandos ESC/POS.
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = [ESC, 0x40]; // ESC @  reinicia la impresora
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const SIZE_DOUBLE = [GS, 0x21, 0x11]; // ancho y alto x2
const SIZE_NORMAL = [GS, 0x21, 0x00];
const FEED_AND_CUT = [GS, 0x56, 0x42, 0x00]; // corte parcial; la TM-P20 sin cutter lo ignora

// Puntuación no-ASCII común en nombres y comentarios, con su reemplazo legible.
// El "·" (punto medio) es el que usan los negocios como separador ("01 · Jamón")
// y sin esto sale como basura en la impresora.
const PUNTUACION: Record<string, string> = {
  "·": "-",
  "•": "-",
  "–": "-",
  "—": "-",
  "¿": "?",
  "¡": "!",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "…": "...",
};

function aAscii(texto: string): string {
  return (
    texto
      // Saca las tildes descomponiendo la letra y borrando el acento: á→a, ñ→n,
      // ü→u, etc. Cubre cualquier acentuada sin listarlas una por una.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Puntuación conocida a su equivalente ASCII.
      .replace(/[·•–—¿¡“”‘’…]/g, (c) => PUNTUACION[c] ?? "")
      // Lo que quede fuera del ASCII imprimible se descarta: mejor un carácter
      // de menos que basura en el ticket.
      .replace(/[^\x20-\x7e]/g, "")
  );
}

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const formatearPrecio = (n: number) => `$${money.format(Math.round(n))}`;

/** Dos columnas: texto a la izquierda, monto pegado a la derecha. */
function lineaDoble(izq: string, der: string, ancho: number): string {
  const espacio = Math.max(1, ancho - izq.length - der.length);
  if (espacio < 1) {
    // No entra en una línea: el texto va arriba y el monto alineado abajo.
    return `${izq}\n${der.padStart(ancho)}`;
  }
  return izq + " ".repeat(espacio) + der;
}

export function buildTicket(data: TicketData): Uint8Array {
  const ancho = data.widthChars ?? 32;
  const bytes: number[] = [];

  const texto = (s: string) => {
    const enc = new TextEncoder().encode(aAscii(s));
    for (const b of enc) bytes.push(b);
  };
  const cmd = (arr: number[]) => bytes.push(...arr);
  const nl = () => bytes.push(LF);
  const sep = () => {
    texto("-".repeat(ancho));
    nl();
  };

  cmd(INIT);

  // Encabezado: nombre del comercio grande y centrado.
  cmd(ALIGN_CENTER);
  cmd(BOLD_ON);
  cmd(SIZE_DOUBLE);
  texto(data.companyName);
  nl();
  cmd(SIZE_NORMAL);
  cmd(BOLD_OFF);
  nl();

  // Número de pedido, lo más visible del ticket.
  cmd(BOLD_ON);
  cmd(SIZE_DOUBLE);
  texto(`Pedido ${formatearNumeroPedido(data.businessDate, data.orderNumber)}`);
  nl();
  cmd(SIZE_NORMAL);
  cmd(BOLD_OFF);

  cmd(ALIGN_LEFT);
  nl();

  const fecha = data.createdAt.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  texto(`Fecha: ${fecha}`);
  nl();
  texto(`Cliente: ${data.customerName}`);
  nl();
  texto(
    `Entrega: ${data.deliveryMethod === "local" ? "Comer en el local" : "Retira en mostrador"}`,
  );
  nl();
  if (data.paymentMethod) {
    texto(`Pago: ${data.paymentMethod === "efectivo" ? "Efectivo" : "Mercado Pago"}`);
    nl();
  }

  sep();

  // Ítems: cantidad x nombre, con el subtotal a la derecha. El precio unitario
  // ya incluye los extras (se congeló así en el pedido). Debajo, lo sacado y lo
  // agregado, que es lo que mira la cocina.
  for (const it of data.items) {
    const izq = `${it.quantity}x ${it.name}`;
    const der = formatearPrecio(it.unitPrice * it.quantity);
    texto(lineaDoble(izq, der, ancho));
    nl();
    for (const r of it.removed ?? []) {
      texto(`   sin ${r}`);
      nl();
    }
    for (const e of it.extras ?? []) {
      texto(`   +${e.quantity} ${e.name}`);
      nl();
    }
  }

  sep();

  // Total grande.
  cmd(BOLD_ON);
  cmd(SIZE_DOUBLE);
  texto(lineaDoble("TOTAL", formatearPrecio(data.total), Math.floor(ancho / 2)));
  nl();
  cmd(SIZE_NORMAL);
  cmd(BOLD_OFF);

  if (data.comments?.trim()) {
    nl();
    texto("Comentarios:");
    nl();
    texto(data.comments.trim());
    nl();
  }

  // Aire al final para poder cortar el papel a mano en las que no tienen cutter.
  cmd([LF, LF, LF, LF]);
  cmd(FEED_AND_CUT);

  return new Uint8Array(bytes);
}
