import { horaArgentina } from "@/lib/jornada";
import { linkWhatsApp } from "@/lib/whatsapp";

/**
 * El WhatsApp de "recibimos tu pedido" que el local le manda al cliente desde
 * la comandera con dos toques: el texto ya armado, con el número, para cuándo
 * está, el código y el link del seguimiento. Sale del WhatsApp del local, así
 * que llega de un número que el cliente conoce.
 *
 * No es automático a propósito: mandar mensajes solo exige la API oficial de
 * WhatsApp (número dedicado, verificación de Meta, costo por conversación),
 * que es el bot que va como producto aparte.
 */
export interface PedidoAvisable {
  customerName: string;
  customerPhone: string | null;
  numero: string;
  codigo: string | null;
  deliveryMethod: "local" | "mostrador" | "envio";
  acceptedAt: string | null;
  etaMinutes: number | null;
  /** Dirección completa del seguimiento (con origen), o null. */
  seguimiento: string | null;
}

export function mensajeRecibido(p: PedidoAvisable, empresa: string): string {
  const nombre = p.customerName.trim().split(/\s+/)[0] || p.customerName;
  // Sin emojis: el link de WhatsApp (wa.me) rompe algunos y llegan como "�".
  const lineas = [`¡Hola ${nombre}! Recibimos tu pedido ${p.numero} en ${empresa}.`];
  if (p.acceptedAt && p.etaMinutes) {
    const hora = horaArgentina(new Date(new Date(p.acceptedAt).getTime() + p.etaMinutes * 60_000));
    lineas.push(
      p.deliveryMethod === "envio"
        ? `Te llega alrededor de las ${hora}.`
        : `Está listo para retirar alrededor de las ${hora}.`,
    );
  }
  if (p.codigo) lineas.push(`Tu código: ${p.codigo}`);
  if (p.seguimiento) lineas.push("", "Seguilo en vivo acá:", p.seguimiento);
  return lineas.join("\n");
}

/** El link de WhatsApp con el mensaje, o null si el teléfono no sirve para WhatsApp. */
export function linkAvisoRecibido(p: PedidoAvisable, empresa: string): string | null {
  return linkWhatsApp(p.customerPhone, mensajeRecibido(p, empresa));
}
