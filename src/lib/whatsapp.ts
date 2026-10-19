/**
 * Link de WhatsApp a partir del teléfono que cargó el local, como lo escriben
 * en Argentina ("0223 15 555-0000", "+54 9 11 5555-0000", "2235550000").
 *
 * WhatsApp quiere el número internacional de celular: 54, un 9, el área sin el
 * 0 y el número sin el 15. Si el teléfono no se puede llevar a esa forma con
 * seguridad, devuelve null y el botón no se muestra: un link a un número
 * equivocado es peor que no tenerlo.
 */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // El 15 del celular va después del código de área (2 a 4 dígitos).
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  return d.length === 10 ? `549${d}` : null;
}

export function linkWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const n = numeroWhatsApp(telefono);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : null;
}
