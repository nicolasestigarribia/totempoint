import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bike, ChevronRight, Clock, MapPin, Store } from "lucide-react";
import type { OnlineEmpresa, SucursalOnline } from "@/lib/api/totem.functions";
import { BuscadorDireccion } from "@/components/online/BuscadorDireccion";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cotizarEnvio, distanciaKm, formatearDistancia } from "@/lib/delivery";
import { estadoHorario } from "@/lib/horario";
import { formatPrice } from "@/lib/totem-cart";
import { onlineCartKey } from "@/lib/online-menu-cache";
import { guardarEleccion, llevarCarrito } from "@/lib/online-eleccion";
import type { Lugar } from "@/lib/geocoding";

/** En qué pantalla de la hoja está el cliente. */
export type PasoHoja = "como" | "envio" | "retiro" | "ver";

/**
 * Lo que sube desde abajo al tocar Pedir en la portada de la empresa. Como en
 * PedidosYa: primero cómo lo quiere, después dónde está, y al final quién le
 * llega. Para un envío pone su dirección y ve las sucursales que llegan, con
 * el costo, la distancia y si están abiertas; elige una y entra a su menú con
 * la dirección ya cargada. Las cerradas se muestran pero no se eligen: el
 * pedido sigue con otra que esté abierta.
 *
 * La elección viaja por el teléfono y nunca por la URL (una dirección es un
 * dato personal): `guardarEleccion` la deja para el carrito de esa sucursal.
 */
export function HojaPedir({
  empresa,
  elegir,
  paso: pasoPedido,
  onPaso,
}: {
  empresa: OnlineEmpresa;
  /** El mismo de la portada: ahí se dibuja la pantalla de carga al elegir. */
  elegir: ElegirSucursal;
  /** null: cerrada. */
  paso: PasoHoja | null;
  onPaso: (paso: PasoHoja | null) => void;
}) {
  const accent = empresa.accentColor || "var(--primary)";
  const irA = (p: PasoHoja) => onPaso(p);
  // Al cerrar, la hoja sigue en pantalla mientras baja: se dibuja el último
  // paso para que no se vacíe de golpe (y no pierda su título).
  const ultimo = useRef<PasoHoja>("como");
  if (pasoPedido) ultimo.current = pasoPedido;
  const paso = ultimo.current;

  const hayEnvio = empresa.sucursales.some((s) => s.delivery);
  const hayRetiro = empresa.sucursales.some((s) => s.pickup);

  return (
    <Drawer
      open={pasoPedido !== null}
      onOpenChange={(abierta) => !abierta && onPaso(null)}
      shouldScaleBackground={false}
      // En el iPhone vaul fija el body con position: fixed y lo suelta al
      // cerrar; si la hoja se desmonta abierta (se elige y se navega), la
      // página siguiente quedaba trabada. El bloqueo de fondo lo sigue haciendo
      // el diálogo, que sí se libera al desmontarse.
      noBodyStyles
    >
      <DrawerContent className="max-h-[92svh] totem-tipografia">
        <DrawerDescription className="sr-only">
          Elegí cómo querés tu pedido y de qué sucursal.
        </DrawerDescription>
        <div className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto px-5 pb-8 pt-4">
          {paso === "como" && (
            <section className="space-y-3">
              <DrawerTitle className="font-display text-3xl">¿Cómo lo querés?</DrawerTitle>
              <div className="grid grid-cols-2 gap-3">
                <BotonComo
                  icono={<Bike className="h-7 w-7" />}
                  titulo="Envío"
                  detalle="Te lo llevamos"
                  accent={accent}
                  onClick={() => irA("envio")}
                />
                <BotonComo
                  icono={<Store className="h-7 w-7" />}
                  titulo="Retiro"
                  detalle="Pasás a buscarlo"
                  accent={accent}
                  onClick={() => {
                    const retiro = empresa.sucursales.filter((s) => s.pickup);
                    if (retiro.length === 1) elegir.pedir(retiro[0], "mostrador", null);
                    else irA("retiro");
                  }}
                />
              </div>
            </section>
          )}

          {paso === "envio" && (
            <PasoEnvio
              empresa={empresa}
              accent={accent}
              volver={hayEnvio && hayRetiro ? () => irA("como") : null}
              verRetiro={hayRetiro ? () => irA("retiro") : null}
              onElegir={(s, lugar) => elegir.pedir(s, "envio", lugar)}
            />
          )}

          {paso === "retiro" && (
            <section className="space-y-3">
              <Encabezado
                titulo="¿Dónde lo retirás?"
                volver={hayEnvio && hayRetiro ? () => irA("como") : null}
              />
              <ul className="space-y-2">
                {empresa.sucursales
                  .filter((s) => s.pickup)
                  .map((s) => {
                    const h = estadoHorario(s.horarios);
                    return (
                      <li key={s.slug}>
                        <FilaSucursal
                          nombre={s.name}
                          detalle={s.address ?? "Retiro en el local"}
                          abierta={h.abierto}
                          abre={h.texto}
                          accent={accent}
                          onClick={() => elegir.pedir(s, "mostrador", null)}
                        />
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          {paso === "ver" && (
            <section className="space-y-3">
              <Encabezado titulo="¿De qué sucursal querés ver el menú?" volver={null} />
              <ul className="space-y-2">
                {empresa.sucursales.map((s) => (
                  <li key={s.slug}>
                    <FilaSucursal
                      nombre={s.name}
                      detalle={s.address ?? "Ver el menú"}
                      abierta
                      abre={null}
                      accent={accent}
                      onClick={() => elegir.ver(s)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export type ElegirSucursal = ReturnType<typeof useElegirSucursal>;

/**
 * Lo que pasa al elegir una sucursal: entrar a su menú, para pedir o para
 * mirar. El menú se pide al servidor y tarda: `yendo` queda en true hasta que
 * la portada se desmonta, para tapar la pantalla con la marca mientras tanto.
 */
export function useElegirSucursal(empresa: OnlineEmpresa) {
  const navigate = useNavigate();
  const [yendo, setYendo] = useState(false);
  const ir = (navegacion: Promise<void>) => {
    setYendo(true);
    // Si la navegación falla, el error lo muestra la ruta; la portada vuelve a dejar tocar.
    navegacion.catch(() => setYendo(false));
  };
  return {
    yendo,
    pedir: (s: SucursalOnline, entrega: "envio" | "mostrador", lugar: Lugar | null) => {
      const cartKey = onlineCartKey(empresa.slug, s.slug);
      llevarCarrito(empresa.slug, cartKey);
      guardarEleccion(cartKey, {
        entrega,
        destino:
          entrega === "envio" && lugar
            ? { lat: lugar.lat, lng: lugar.lng, address: lugar.label, details: "" }
            : null,
      });
      ir(navigate({ to: "/p/$empresa/$local", params: { empresa: empresa.slug, local: s.slug } }));
    },
    ver: (s: SucursalOnline) =>
      ir(
        navigate({
          to: "/p/$empresa/$local",
          params: { empresa: empresa.slug, local: s.slug },
          search: { ver: true },
        }),
      ),
  };
}

function PasoEnvio({
  empresa,
  accent,
  volver,
  verRetiro,
  onElegir,
}: {
  empresa: OnlineEmpresa;
  accent: string;
  volver: (() => void) | null;
  verRetiro: (() => void) | null;
  onElegir: (s: SucursalOnline, lugar: Lugar) => void;
}) {
  const [lugar, setLugar] = useState<Lugar | null>(null);

  // Las sucursales que llegan a esa dirección: las abiertas primero, y entre
  // ellas de la más cercana a la más lejana.
  const opciones = useMemo(() => {
    if (!lugar) return [];
    return empresa.sucursales
      .filter((s) => s.delivery && s.origin)
      .map((s) => {
        const km = distanciaKm(s.origin!, lugar);
        return { s, km, cotizacion: cotizarEnvio(s.tiers, km), horario: estadoHorario(s.horarios) };
      })
      .filter((o) => o.cotizacion.llega)
      .sort((a, b) => Number(b.horario.abierto) - Number(a.horario.abierto) || a.km - b.km);
  }, [lugar, empresa.sucursales]);

  // Para centrar la búsqueda: la primera sucursal que hace envíos.
  const cerca = empresa.sucursales.find((s) => s.origin)?.origin ?? null;

  return (
    <section className="space-y-3">
      <Encabezado titulo="¿A dónde te lo llevamos?" volver={volver} />
      <BuscadorDireccion cerca={cerca} onElegir={setLugar} />
      {lugar &&
        (opciones.length === 0 ? (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            No llegamos a esa dirección desde ninguna sucursal.
            {verRetiro && (
              <button
                type="button"
                onClick={verRetiro}
                className="mt-2 block font-bold underline underline-offset-4"
              >
                Ver dónde retirar
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {opciones.length === 1
                ? "Te llega desde esta sucursal:"
                : "Te llegan desde estas sucursales. Elegí una:"}
            </p>
            <ul className="space-y-2">
              {opciones.map(({ s, km, cotizacion, horario }) => (
                <li key={s.slug}>
                  <FilaSucursal
                    nombre={s.name}
                    detalle={`A ${formatearDistancia(km)} · Envío ${
                      cotizacion.llega && cotizacion.precio > 0
                        ? formatPrice(cotizacion.precio)
                        : "gratis"
                    }`}
                    abierta={horario.abierto}
                    abre={horario.texto}
                    accent={accent}
                    onClick={() => onElegir(s, lugar)}
                  />
                </li>
              ))}
            </ul>
          </>
        ))}
    </section>
  );
}

function Encabezado({ titulo, volver }: { titulo: string; volver: (() => void) | null }) {
  return (
    <div className="flex items-center gap-3">
      {volver && (
        <button
          type="button"
          onClick={volver}
          aria-label="Atrás"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <DrawerTitle className="font-display text-2xl leading-tight">{titulo}</DrawerTitle>
    </div>
  );
}

function BotonComo({
  icono,
  titulo,
  detalle,
  accent,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-3xl border-2 border-border bg-card px-2 py-6 transition hover:border-primary active:scale-95"
    >
      <span style={{ color: accent }}>{icono}</span>
      <span className="font-display text-2xl">{titulo}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </button>
  );
}

/**
 * Una sucursal para elegir. Cerrada se ve, con cuándo abre, pero no se toca:
 * el pedido tiene que ir a una que lo pueda preparar ahora.
 */
function FilaSucursal({
  nombre,
  detalle,
  abierta,
  abre,
  accent,
  onClick,
}: {
  nombre: string;
  detalle: string;
  abierta: boolean;
  abre: string | null;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!abierta}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 text-left transition enabled:hover:border-primary disabled:opacity-50"
    >
      <MapPin className="h-5 w-5 shrink-0" style={{ color: abierta ? accent : undefined }} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{nombre}</span>
        <span className="block text-sm text-muted-foreground">{detalle}</span>
        {!abierta && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-amber-500">
            <Clock className="h-3.5 w-3.5" /> Cerrada · abre {abre}
          </span>
        )}
      </span>
      {abierta && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </button>
  );
}
