import { useContext, useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TotemCombo, TotemProduct } from "@/lib/api/totem.functions";
import { MAX_POR_LINEA } from "@/lib/pedido-reglas";
import { partirNombre } from "@/lib/menu-online";
import { ElegirGustos } from "@/components/online/ElegirGustos";
import { ElegirPan } from "@/components/totem/ElegirPan";
import { SoloVer } from "@/components/online/menu/solo-ver";
import { useRevelar } from "@/components/online/menu/useRevelar";
import {
  useTotemCart,
  formatPrice,
  itemKey,
  claveDe,
  regaloDeProducto,
  type Pan,
  type TotemCartItem,
  type TotemCartEleccion,
} from "@/lib/totem-cart";

/**
 * Cuántas unidades de esta tarjeta hay en el pedido. Cada tarjeta se suscribe
 * solo a ese número: con el menú entero en una lista, leer el carrito completo
 * redibujaría todas las tarjetas con cada "+1".
 */
function useEnCarrito(cartKey: string, cuenta: (items: TotemCartItem[]) => number): number {
  return useTotemCart((s) => (s.slug === cartKey ? cuenta(s.items) : 0));
}

/**
 * La tarjeta del menú, como la del tótem: la foto manda, con el nombre encima,
 * y debajo todo lo que dice, sin recortes. En el celular se recorre con el
 * pulgar, así que no hay nada que abrir para leer.
 */
function TarjetaGrande({
  accent,
  foto,
  nombre,
  indice,
  enCarrito,
  contenido,
  opciones,
  pie,
}: {
  accent: string;
  foto: string | null;
  nombre: string;
  /** Su lugar en la sección: entra unos milisegundos después que la anterior. */
  indice: number;
  /** Lo que ya está en el pedido se marca con el color de la marca. */
  enCarrito: boolean;
  contenido: React.ReactNode;
  /** Lo que se elige (el pan, los gustos de un combo). */
  opciones?: React.ReactNode;
  /** Precio y agregar. */
  pie: React.ReactNode;
}) {
  const { numero, resto } = partirNombre(nombre);
  const [revelar, visible] = useRevelar<HTMLDivElement>();
  return (
    // La entrada al llegar a la pantalla va en una capa y el crecer al tocar en
    // otra: las dos mueven la tarjeta, y en el mismo elemento el retraso de la
    // entrada demoraría también la respuesta al dedo.
    <div
      ref={revelar}
      className={`revela ${visible ? "visible" : ""}`}
      // En dos columnas, la de la derecha entra un instante después.
      style={{ transitionDelay: `${(indice % 2) * 90}ms` }}
    >
      <article
        // Como en el tótem, la tarjeta se levanta y crece al pasar o tocar.
        className={`flex h-full flex-col overflow-hidden rounded-3xl bg-card/60 shadow-card transition duration-300 hover:-translate-y-1 hover:scale-[1.02] active:-translate-y-1 active:scale-[1.02] motion-reduce:transform-none ${
          enCarrito ? "border-2" : "border border-border/60"
        }`}
        style={
          // Lo que ya está en el pedido brilla con el color de la marca.
          enCarrito ? { borderColor: accent, boxShadow: `0 18px 40px -18px ${accent}` } : undefined
        }
      >
        <div className="relative h-48 w-full overflow-hidden">
          <FotoGrande url={foto} accent={accent} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          {numero && (
            <span
              className="absolute left-3 top-3 rounded-full px-2 py-1 text-xs font-black leading-none text-white"
              style={{ background: accent }}
              aria-label={`Número ${numero}`}
            >
              N°{numero}
            </span>
          )}
          <h3 className="absolute inset-x-4 bottom-3 font-display text-3xl leading-none text-white drop-shadow-lg">
            {resto}
          </h3>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="text-sm text-muted-foreground">{contenido}</div>
          {opciones}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            {pie}
          </div>
        </div>
      </article>
    </div>
  );
}

/** La foto de la tarjeta; sin foto, un fondo con el color de la marca. */
function FotoGrande({ url, accent }: { url: string | null; accent: string }) {
  const [cargada, setCargada] = useState(false);
  if (!url) {
    return (
      <div
        className="absolute inset-0 bg-card"
        style={{ backgroundImage: `linear-gradient(135deg, ${accent}, transparent 75%)` }}
      />
    );
  }
  return (
    <div className={`absolute inset-0 ${cargada ? "bg-muted" : "cargando-foto"}`}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onLoad={() => setCargada(true)}
        // Si ya estaba en caché, terminó de cargar antes de que la página se
        // activara y el onLoad no llega: se mira al montarla.
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0 && !cargada) setCargada(true);
        }}
        className={`h-full w-full object-cover transition-opacity duration-500 ${cargada ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/**
 * El botón de agregar, que se abre en − cantidad + cuando ya hay unidades: así
 * equivocarse tocando se arregla ahí mismo, sin ir al pedido. Cada agregar
 * suelta un "+1" que sube: confirma que entró sin tapar nada.
 */
function Cantidad({
  clave,
  enCarrito,
  accent,
  onAgregar,
  nombre,
}: {
  clave: string;
  enCarrito: number;
  accent: string;
  onAgregar: () => void;
  nombre: string;
}) {
  const removeOne = useTotemCart((s) => s.removeOne);
  const [pulsos, setPulsos] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const agregar = () => {
    onAgregar();
    const id = Date.now() + Math.random();
    setPulsos((ps) => [...ps, id]);
    timers.current.push(
      window.setTimeout(() => setPulsos((ps) => ps.filter((p) => p !== id)), 700),
    );
  };

  const unos = pulsos.map((id) => (
    <span
      key={id}
      aria-hidden
      className="sube-uno absolute -top-2 right-3 font-display text-2xl"
      style={{ color: accent }}
    >
      +1
    </span>
  ));

  if (enCarrito === 0) {
    return (
      <div className="relative">
        {unos}
        <button
          type="button"
          onClick={agregar}
          aria-label={`Agregar ${nombre}`}
          className="flex h-12 items-center gap-1.5 rounded-2xl px-5 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: accent }}
        >
          <Plus className="h-5 w-5" /> Agregar
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      {unos}
      <div
        className="salta flex items-center gap-1 rounded-2xl p-1 text-white"
        style={{ background: accent }}
      >
        <button
          type="button"
          onClick={() => removeOne(clave)}
          aria-label={enCarrito === 1 ? `Quitar ${nombre}` : `Quitar un ${nombre}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-black/20 active:scale-95"
        >
          {enCarrito === 1 ? <Trash2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
        </button>
        <span className="min-w-8 text-center font-display text-2xl">{enCarrito}</span>
        <button
          type="button"
          onClick={agregar}
          disabled={enCarrito >= MAX_POR_LINEA}
          aria-label={`Agregar otro ${nombre}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-black/20 active:scale-95 disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function Precio({ valor, accent }: { valor: string; accent: string }) {
  return (
    <span className="font-display text-3xl leading-none" style={{ color: accent }}>
      {formatPrice(valor)}
    </span>
  );
}

export function TarjetaProducto({
  producto: p,
  cartKey,
  accent,
  indice,
}: {
  producto: TotemProduct;
  cartKey: string;
  accent: string;
  indice: number;
}) {
  const add = useTotemCart((s) => s.add);
  const soloVer = useContext(SoloVer);
  // En los que se hacen en blanco o negro, el − / + maneja el pan marcado.
  const [panElegido, setPanElegido] = useState<Pan>("blanco");
  const pan = p.pan === "ambos" ? panElegido : undefined;
  // El − / + maneja la versión sin cambios; las personalizadas se editan en
  // "Tu pedido", donde se ven una por una.
  const clave = itemKey("producto", p.id, [], [], pan);
  const enCarrito = useEnCarrito(
    cartKey,
    (items) => items.find((i) => claveDe(i) === clave)?.quantity ?? 0,
  );
  const personalizable = p.removables.length > 0 || p.extras.length > 0;

  return (
    <TarjetaGrande
      accent={accent}
      foto={p.photoUrl}
      nombre={p.name}
      indice={indice}
      enCarrito={enCarrito > 0}
      contenido={
        <>
          {p.description && <p>{p.description}</p>}
          {personalizable && !soloVer && (
            <p className="mt-1 text-xs">Le podés sacar o agregar cosas desde tu pedido</p>
          )}
        </>
      }
      opciones={
        p.pan &&
        (soloVer ? (
          <p className="text-xs text-muted-foreground">
            {p.pan === "ambos" ? "En pan blanco o negro" : `En pan ${p.pan}`}
          </p>
        ) : (
          <ElegirPan pan={p.pan} elegido={panElegido} onElegir={setPanElegido} accent={accent} />
        ))
      }
      pie={
        <>
          <Precio valor={p.price} accent={accent} />
          {!soloVer && (
            <Cantidad
              clave={clave}
              enCarrito={enCarrito}
              accent={accent}
              nombre={p.name}
              onAgregar={() =>
                add(cartKey, {
                  kind: "producto",
                  refId: p.id,
                  name: p.name,
                  price: p.price,
                  photoUrl: p.photoUrl,
                  pan,
                  regalo: regaloDeProducto(p),
                })
              }
            />
          )}
        </>
      }
    />
  );
}

export function TarjetaCombo({
  combo: c,
  cartKey,
  accent,
  indice,
}: {
  combo: TotemCombo;
  cartKey: string;
  accent: string;
  indice: number;
}) {
  const add = useTotemCart((s) => s.add);
  const soloVer = useContext(SoloVer);
  const clave = itemKey("combo", c.id);
  const aEleccion = c.grupos.length > 0;
  // Un combo a elección puede estar varias veces con gustos distintos: se
  // cuentan todas sus líneas.
  const enCarrito = useEnCarrito(cartKey, (items) =>
    aEleccion
      ? items
          .filter((i) => i.kind === "combo" && i.refId === c.id)
          .reduce((t, i) => t + i.quantity, 0)
      : (items.find((i) => claveDe(i) === clave)?.quantity ?? 0),
  );
  const unidades =
    c.items.reduce((t, i) => t + i.quantity, 0) + c.grupos.reduce((t, g) => t + g.cantidad, 0);
  const [armando, setArmando] = useState(false);

  const agregar = (elecciones?: TotemCartEleccion[]) =>
    add(cartKey, {
      kind: "combo",
      refId: c.id,
      name: c.name,
      price: c.price,
      photoUrl: c.photoUrl,
      regalo: c.regalo,
      elecciones,
    });

  return (
    <TarjetaGrande
      accent={accent}
      foto={c.photoUrl}
      nombre={c.name}
      indice={indice}
      enCarrito={enCarrito > 0}
      contenido={
        <>
          {c.description && <p className="mb-2">{c.description}</p>}
          <p className="text-xs font-bold uppercase tracking-wide">
            Trae {unidades} {unidades === 1 ? "unidad" : "unidades"}
          </p>
          <ul className="mt-1 space-y-0.5 text-foreground">
            {c.grupos.map((g) => (
              <li key={`g${g.indice}`} className="flex gap-2">
                <span className="w-7 shrink-0 text-right font-bold">{g.cantidad}×</span>
                <span>{g.nombre}, a elección</span>
              </li>
            ))}
            {c.items.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="w-7 shrink-0 text-right font-bold">{i.quantity}×</span>
                <span>{i.name}</span>
              </li>
            ))}
          </ul>
        </>
      }
      opciones={
        armando ? (
          <ElegirGustos
            grupos={c.grupos}
            accent={accent}
            textoBoton={`Agregar al pedido · ${formatPrice(c.price)}`}
            onCancelar={() => setArmando(false)}
            onListo={(elecciones) => {
              agregar(elecciones);
              setArmando(false);
              toast.success(`${c.name} agregado a tu pedido`);
            }}
          />
        ) : undefined
      }
      pie={
        armando ? null : (
          <>
            <Precio valor={c.price} accent={accent} />
            {soloVer ? null : aEleccion ? (
              <button
                type="button"
                onClick={() => setArmando(true)}
                disabled={enCarrito >= MAX_POR_LINEA}
                className="flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-5 font-display text-lg uppercase tracking-wide text-white transition active:scale-95 disabled:opacity-40"
                style={{ background: accent }}
              >
                <Plus className="h-5 w-5" />
                {enCarrito ? `Otro (${enCarrito})` : "Elegir gustos"}
              </button>
            ) : (
              <Cantidad
                clave={clave}
                enCarrito={enCarrito}
                accent={accent}
                nombre={c.name}
                onAgregar={() => agregar()}
              />
            )}
          </>
        )
      }
    />
  );
}
