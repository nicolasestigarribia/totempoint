/**
 * La comanda de cocina: el papel que sale en la cocina cuando entra un pedido.
 *
 * No es el ticket del cliente (`ticket.ts`, ESC/POS por Bluetooth desde el
 * tótem): es una hoja HTML de 80 mm que imprime el navegador de la comandera.
 * Un navegador no puede hablarle a una térmica por la red del local, pero sí
 * imprimir una página en ella; con Chrome abierto en `--kiosk-printing` sale
 * sin ningún cartel. Así sirve para los pedidos online y de mesa, que nunca
 * pasan por una tablet de tótem.
 *
 * Es una función pura: recibe los pedidos y devuelve el HTML, sin tocar el DOM.
 * Lo que va grande es lo que se mira de lejos con las manos ocupadas: el
 * número, la mesa o el envío, y si hay que cobrarlo.
 */

import { formatearNumeroPedido } from "@/lib/order-number";
import { horaArgentina } from "@/lib/jornada";

export interface ComandaItem {
  productName: string;
  quantity: number;
  removed: string[];
  extras: { name: string; quantity: number }[];
  pan: string | null;
  tamanio: string | null;
  elecciones: { name: string; quantity: number }[];
}

export interface ComandaPedido {
  orderNumber: number;
  codigo: string | null;
  businessDate: string;
  customerName: string;
  createdAt: string;
  acceptedAt: string | null;
  etaMinutes: number | null;
  channel: "totem" | "online" | "mesa";
  tableNumber: number | null;
  deliveryMethod: "local" | "mostrador" | "envio";
  deliveryAddress: string | null;
  deliveryDetails: string | null;
  customerPhone: string | null;
  comments: string | null;
  regaloUnidades: number;
  paymentMethod: "efectivo" | "mercadopago";
  paymentStatus: "pendiente" | "pagado" | "reembolso_pendiente";
  cashPaysWith: string | null;
  total: string;
  items: ComandaItem[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pesos = (n: number) =>
  `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/** La hora en Argentina: la comandera puede estar en cualquier zona, el local no. */
const hora = (iso: string) => horaArgentina(iso);

/** Dónde va el pedido, en mayúsculas: lo primero que se lee. */
export function destinoComanda(p: ComandaPedido): string {
  if (p.channel === "mesa" && p.tableNumber !== null) return `MESA ${p.tableNumber}`;
  if (p.deliveryMethod === "envio") return "ENVÍO";
  if (p.deliveryMethod === "local") return "COMER ACÁ";
  return "RETIRA";
}

/** Si hay que cobrarlo y cuánto: lo que evita que un pedido salga sin pagar. */
export function cobroComanda(p: ComandaPedido): { texto: string; alerta: boolean } {
  if (p.paymentStatus === "pagado") {
    return {
      texto: p.paymentMethod === "mercadopago" ? "PAGADO · MERCADO PAGO" : "PAGADO",
      alerta: false,
    };
  }
  if (p.paymentStatus === "reembolso_pendiente") return { texto: "DEVOLVER EL PAGO", alerta: true };
  const total = Number(p.total);
  if (p.paymentMethod === "mercadopago") {
    return { texto: `MERCADO PAGO SIN CONFIRMAR · ${pesos(total)}`, alerta: true };
  }
  const pagaCon = p.cashPaysWith ? Number(p.cashPaysWith) : null;
  const vuelto =
    pagaCon && pagaCon > total
      ? ` · paga con ${pesos(pagaCon)}, vuelto ${pesos(pagaCon - total)}`
      : "";
  return { texto: `COBRAR ${pesos(total)} EFECTIVO${vuelto}`, alerta: true };
}

function hoja(p: ComandaPedido): string {
  const numero = formatearNumeroPedido(p.businessDate, p.orderNumber);
  const cobro = cobroComanda(p);
  const listo =
    p.acceptedAt && p.etaMinutes
      ? hora(new Date(new Date(p.acceptedAt).getTime() + p.etaMinutes * 60_000).toISOString())
      : null;

  const items = p.items
    .map((it) => {
      const detalle = [
        it.tamanio ? esc(it.tamanio) : null,
        it.pan ? `pan ${esc(it.pan)}` : null,
        ...it.elecciones.map((e) => `${e.quantity}x ${esc(e.name)}`),
        ...it.removed.map((r) => `<b>SIN ${esc(r.toUpperCase())}</b>`),
        ...it.extras.map((e) => `<b>+${e.quantity} ${esc(e.name)}</b>`),
      ].filter(Boolean);
      return `<div class="it"><div class="q">${it.quantity}x</div><div><div class="n">${esc(
        it.productName,
      )}</div>${detalle.map((d) => `<div class="d">${d}</div>`).join("")}</div></div>`;
    })
    .join("");

  const envio =
    p.deliveryMethod === "envio"
      ? `<div class="caja">${p.deliveryAddress ? `<div class="n">${esc(p.deliveryAddress)}</div>` : ""}${
          p.deliveryDetails ? `<div>${esc(p.deliveryDetails)}</div>` : ""
        }${p.customerPhone ? `<div>Tel ${esc(p.customerPhone)}</div>` : ""}</div>`
      : "";

  return `<section class="hoja">
  <div class="fila"><span class="num">${numero}</span><span class="dest">${destinoComanda(p)}</span></div>
  <div class="fila sub"><span>${esc(p.customerName)}</span><span>${hora(p.createdAt)}${
    listo ? ` · listo ${listo}` : ""
  }</span></div>
  ${p.codigo ? `<div class="cod">Código <b>${esc(p.codigo)}</b></div>` : ""}
  <hr/>
  ${items}
  ${p.regaloUnidades > 0 ? `<div class="caja"><b>+${p.regaloUnidades} DE REGALO</b> a elección del local</div>` : ""}
  ${p.comments?.trim() ? `<div class="caja"><b>Nota:</b> ${esc(p.comments.trim())}</div>` : ""}
  ${envio}
  <hr/>
  <div class="cobro${cobro.alerta ? " alerta" : ""}">${esc(cobro.texto)}</div>
</section>`;
}

/**
 * Una o varias comandas en un solo documento, una por hoja: cuando entran
 * varios pedidos juntos sale un solo trabajo de impresión, no un cartel por
 * pedido.
 */
export function comandasHtml(pedidos: ComandaPedido[]): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comanda</title>
<style>
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
.hoja { width: 72mm; margin: 0 auto; padding: 3mm 0 8mm; page-break-after: always; break-after: page; }
.hoja:last-child { page-break-after: auto; break-after: auto; }
.fila { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
.num { font-size: 26pt; font-weight: 900; }
.dest { font-size: 16pt; font-weight: 900; border: 2px solid #000; padding: 0 2mm; }
.sub { font-size: 10pt; margin-top: 1mm; }
.cod { font-size: 11pt; margin-top: 1mm; letter-spacing: 1px; }
.cod b { font-family: "Courier New", monospace; font-size: 15pt; letter-spacing: 3px; }
hr { border: 0; border-top: 2px dashed #000; margin: 2.5mm 0; }
.it { display: flex; gap: 2mm; margin-bottom: 2mm; }
.q { font-size: 15pt; font-weight: 900; min-width: 9mm; }
.n { font-size: 13pt; font-weight: 700; }
.d { font-size: 11pt; padding-left: 1mm; }
.caja { border: 1.5px solid #000; padding: 1.5mm 2mm; margin-top: 2mm; font-size: 11pt; }
.cobro { font-size: 12pt; font-weight: 900; text-align: center; padding: 1.5mm; }
.cobro.alerta { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${pedidos.map(hoja).join("")}</body></html>`;
}
