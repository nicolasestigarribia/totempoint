import { Link } from "@tanstack/react-router";
import { ArrowLeft, Store } from "lucide-react";
import { TotemPasos, type PasoTotem } from "@/components/totem/TotemPasos";
import type { TotemNav } from "@/lib/totem-nav";

/**
 * Barra de arriba del tótem: marca y vuelta atrás, nada más.
 *
 * El botón de volver dice su destino ("Menú", "Inicio") porque en un tótem se
 * mira de pie y de lejos: un ícono suelto no alcanza para que alguien entienda
 * que ahí se sale de donde está.
 *
 * El carrito se fue a `TotemCartBar`, abajo y con el total a la vista. Tener
 * dos accesos al pedido competía: arriba decía "Ver pedido" sin el monto, que
 * es justo el dato que el cliente quiere.
 *
 * Sólo navega dentro del pedido: nunca sale al panel ni al login.
 */
/**
 * A dónde vuelve cada pantalla, y cómo se llama ese lugar.
 *
 * El nombre es el que muestran los pasos de arriba —"Tu pedido", no
 * "carrito"—, para que el cliente reconozca a dónde va sin traducir nada.
 */
const DESTINO = {
  home: { to: "/t/$empresa/$local/$totem", label: "Inicio" },
  categorias: { to: "/t/$empresa/$local/$totem/categorias", label: "Menú" },
  carrito: { to: "/t/$empresa/$local/$totem/carrito", label: "Tu pedido" },
} as const;

export function TotemTopBar({
  nav,
  name,
  logoUrl,
  accent,
  back = "home",
  paso,
}: {
  nav: TotemNav;
  name: string;
  logoUrl: string | null;
  accent?: string;
  back?: "home" | "categorias" | "carrito";
  /** En qué paso del pedido está. Sin esto no se muestran los pasos. */
  paso?: PasoTotem;
}) {
  return (
    <header
      // Pegada arriba: en un celular la lista de productos es larga y el carrito
      // tiene que estar siempre a mano, no diez pantallazos más arriba.
      className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur md:px-12"
    >
      {/* Dice a dónde vuelve, no sólo que vuelve. Una flecha sola en un
          cuadradito gris, a un metro de la pantalla y de pie, no se lee como
          un botón: se lee como un adorno, y el cliente que se equivocó de
          categoría se queda ahí sin saber cómo salir. */}
      <Link
        to={DESTINO[back].to}
        params={nav}
        className="group flex h-14 shrink-0 items-center gap-2.5 rounded-2xl border-2 border-border bg-card/60 pl-3 pr-5 transition hover:border-primary active:scale-[0.97]"
      >
        <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
        <span className="font-display text-base uppercase tracking-wide">
          {DESTINO[back].label}
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: accent ?? "var(--primary)" }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-5 w-5 text-white" />
          )}
        </div>
        <span className="font-display text-xl tracking-wide">{name}</span>
      </div>

      {paso && (
        <div className="ml-auto">
          <TotemPasos actual={paso} accent={accent} />
        </div>
      )}
    </header>
  );
}
