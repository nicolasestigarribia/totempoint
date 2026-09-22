import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCartForSlug, cartCount, cartTotal, formatPrice } from "@/lib/totem-cart";
import { totemCartKey, type TotemNav } from "@/lib/totem-nav";

/**
 * La barra del pedido, fija abajo de la pantalla.
 *
 * Antes el carrito era un botón chico arriba a la derecha que ni siquiera
 * decía cuánto llevaba gastado el cliente. En un tótem eso son las dos
 * preguntas que alguien se hace mientras elige —cuánto llevo y cómo sigo— y
 * las dos tienen que estar a la vista todo el tiempo, sin tener que tocar
 * nada para averiguarlas.
 *
 * Va abajo y no arriba porque en una tablet parada el pulgar llega ahí, y
 * porque es el camino hacia adelante: lo de arriba es para volver.
 *
 * Aparece sola cuando entra el primer producto y se va cuando el carrito
 * queda vacío; mientras no hay nada, no roba espacio al menú.
 */
export function TotemCartBar({ nav, accent }: { nav: TotemNav; accent?: string }) {
  const items = useCartForSlug(totemCartKey(nav));
  const count = cartCount(items);
  const total = cartTotal(items);

  // Un latido cuando cambia el total: confirma que lo que tocaste entró, sin
  // tapar la pantalla con un cartel ni robarle el foco a lo que está eligiendo.
  const [late, setLate] = useState(false);
  const totalPrevio = useRef(total);
  useEffect(() => {
    if (totalPrevio.current === total) return;
    totalPrevio.current = total;
    setLate(true);
    const id = setTimeout(() => setLate(false), 420);
    return () => clearTimeout(id);
  }, [total]);

  if (count === 0) return null;

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 px-6 py-4 backdrop-blur md:px-12">
      <Link
        to="/t/$empresa/$local/$totem/carrito"
        params={nav}
        className={`mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 rounded-3xl px-6 py-5 shadow-glow transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] ${
          late ? "scale-[1.02]" : ""
        }`}
        style={{ background: accent ?? "var(--primary)" }}
      >
        <span className="flex min-w-0 items-center gap-4 text-white">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20">
            <ShoppingBag className="h-7 w-7" />
            <span className="absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 font-display text-sm text-black">
              {count}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-display text-2xl uppercase tracking-wide md:text-3xl">
              Ver mi pedido
            </span>
            <span className="block text-sm text-white/80">
              {count} {count === 1 ? "producto" : "productos"}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3 text-white">
          <span className="font-display text-3xl md:text-4xl">{formatPrice(total)}</span>
          <ChevronRight className="h-8 w-8" />
        </span>
      </Link>
    </div>
  );
}
