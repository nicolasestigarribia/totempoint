import { Gift } from "lucide-react";
import { formatPrice, regaloDelCarrito, type TotemCartItem } from "@/lib/totem-cart";

/**
 * "Cada 12, 2 de regalo", en el carrito. Dice lo que pasa con su pedido en
 * cada momento: cuántos le faltan, que ya puede elegir sus 2 de regalo, o que
 * los que agregó no se le cobran. Es la misma cuenta que hace el servidor.
 */
export function AvisoRegalo({
  items,
  grande = false,
}: {
  items: TotemCartItem[];
  /** Tamaño del tótem. */
  grande?: boolean;
}) {
  const r = regaloDelCarrito(items);
  if (r.gratis === 0 && r.pendientes === 0 && !r.proximo) return null;

  const plural = (n: number) => (n === 1 ? "sándwich" : "sándwiches");

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 ${
        grande ? "p-5 text-lg" : "p-3 text-sm"
      }`}
    >
      <Gift className={`shrink-0 ${grande ? "h-6 w-6" : "mt-0.5 h-5 w-5"}`} />
      <div className="space-y-0.5">
        {r.gratis > 0 && (
          <p className="font-bold">
            {r.gratis} {plural(r.gratis)} de regalo: no te {r.gratis === 1 ? "lo" : "los"} cobramos
            (−{formatPrice(r.descuento)})
          </p>
        )}
        {r.pendientes > 0 && (
          <p className="font-bold">
            Te {r.pendientes === 1 ? "corresponde" : "corresponden"} {r.pendientes}{" "}
            {r.gratis > 0 ? "más " : ""}de regalo: agregá{" "}
            {r.pendientes === 1 ? "el que" : "los que"} quieras y no te{" "}
            {r.pendientes === 1 ? "lo" : "los"} cobramos
          </p>
        )}
        {r.proximo && (
          <p className={r.gratis > 0 ? "opacity-80" : "font-bold"}>
            Sumá {r.proximo.faltan} más y te regalamos {r.proximo.cantidad}
            {r.gratis > 0 ? " más" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
