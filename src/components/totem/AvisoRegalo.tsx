import { Gift } from "lucide-react";
import {
  partesDelCarrito,
  proximoRegalo,
  unidadesDeRegalo,
  type ReglaRegalo,
  type UnidadesConRegalo,
} from "@/lib/regalo";

/**
 * "Cada 12, 2 de regalo", en el carrito: cuántos le regalan y cuánto le falta
 * para el próximo. Es lo mismo que cuenta el servidor y le muestra la comanda
 * a la cocina; acá es para que el cliente lo sepa y, si le faltan pocos, se
 * anime a completar la docena.
 */
export function AvisoRegalo({
  items,
  productos,
  combos,
  grande = false,
}: {
  items: { kind: "producto" | "combo"; refId: number; quantity: number }[];
  productos: { id: number; regalo: ReglaRegalo | null }[];
  combos: { id: number; regalo: UnidadesConRegalo[] }[];
  /** Tamaño del tótem. */
  grande?: boolean;
}) {
  const partes = partesDelCarrito(items, productos, combos);
  const regalo = unidadesDeRegalo(partes);
  const proximo = proximoRegalo(partes);
  if (regalo === 0 && !proximo) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 ${
        grande ? "p-5 text-lg" : "p-3 text-sm"
      }`}
    >
      <Gift className={`shrink-0 ${grande ? "h-6 w-6" : "mt-0.5 h-5 w-5"}`} />
      <div>
        {regalo > 0 && (
          <p className="font-bold">
            Te regalamos {regalo} {regalo === 1 ? "sándwich" : "sándwiches"} más
          </p>
        )}
        {proximo && (
          <p className={regalo > 0 ? "opacity-80" : "font-bold"}>
            Sumá {proximo.faltan} más y te regalamos {proximo.cantidad}
            {regalo > 0 ? " más" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
