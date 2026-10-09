import { useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Bike, Store, MapPin, ChevronRight, Clock, BookOpen } from "lucide-react";
import { getOnlineEmpresa, type SucursalOnline } from "@/lib/api/totem.functions";
import { OnlineError } from "@/components/online/OnlineError";
import { BuscadorDireccion } from "@/components/online/BuscadorDireccion";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { cotizarEnvio, distanciaKm, formatearDistancia } from "@/lib/delivery";
import { estadoHorario } from "@/lib/horario";
import { formatPrice } from "@/lib/totem-cart";
import { onlineCartKey } from "@/lib/online-menu-cache";
import { guardarEleccion, llevarCarrito } from "@/lib/online-eleccion";
import type { Lugar } from "@/lib/geocoding";

/**
 * El pedido online de la empresa entera, para las que tienen más de una
 * sucursal. Como en PedidosYa: primero dónde estás, después quién te llega.
 *
 * Para un envío el cliente pone su dirección y ve las sucursales que llegan,
 * con el costo, la distancia y si están abiertas; elige una y entra a su menú
 * con la dirección ya cargada. Las cerradas se muestran pero no se eligen: el
 * pedido sigue con otra que esté abierta. Para retirar, elige dónde. Con una
 * sola sucursal no hay nada que elegir y va directo a su menú.
 */
export const Route = createFileRoute("/p/$empresa/")({
  loader: async ({ params }) => {
    const empresa = await getOnlineEmpresa({ data: { empresa: params.empresa } });
    if (empresa.sucursales.length === 1) {
      throw redirect({
        to: "/p/$empresa/$local",
        params: { empresa: params.empresa, local: empresa.sucursales[0].slug },
        statusCode: 302,
      });
    }
    return empresa;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Pedí online — ${loaderData.name}` : "Pedido online" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: EmpresaPage,
});

type Modo = "envio" | "retiro" | "menu";

function EmpresaPage() {
  const empresa = Route.useLoaderData();
  const navigate = useNavigate();
  useTotemTheme(empresa.accentColor, empresa.theme, empresa.fontTheme, empresa.corners);
  const accent = empresa.accentColor || "var(--primary)";

  const hayEnvio = empresa.sucursales.some((s) => s.delivery);
  const hayRetiro = empresa.sucursales.some((s) => s.pickup);
  const [modo, setModo] = useState<Modo | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);

  // Las sucursales que llegan a esa dirección, de la más cercana a la más lejana.
  const opcionesEnvio = useMemo(() => {
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

  const elegir = (s: SucursalOnline, entrega: "envio" | "mostrador") => {
    const cartKey = onlineCartKey(empresa.slug, s.slug);
    llevarCarrito(empresa.slug, cartKey);
    guardarEleccion(cartKey, {
      entrega,
      destino:
        entrega === "envio" && lugar
          ? { lat: lugar.lat, lng: lugar.lng, address: lugar.label, details: "" }
          : null,
    });
    void navigate({ to: "/p/$empresa/$local", params: { empresa: empresa.slug, local: s.slug } });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 pb-4 pt-10 text-center">
        {empresa.logoUrl && (
          <img src={empresa.logoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        )}
        <h1 className="font-display text-4xl leading-none">{empresa.name}</h1>
        <p className="text-sm text-muted-foreground">Pedí online desde tu celular</p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-10">
        <div className={`grid gap-2 ${hayEnvio && hayRetiro ? "grid-cols-3" : "grid-cols-2"}`}>
          {hayEnvio && (
            <BotonModo
              activo={modo === "envio"}
              onClick={() => setModo("envio")}
              icono={<Bike className="h-6 w-6" />}
              titulo="Envío"
              detalle="Te lo llevamos"
              accent={accent}
            />
          )}
          {hayRetiro && (
            <BotonModo
              activo={modo === "retiro"}
              onClick={() => setModo("retiro")}
              icono={<Store className="h-6 w-6" />}
              titulo="Retiro"
              detalle="Pasás a buscarlo"
              accent={accent}
            />
          )}
          {/* Para el QR pegado en el local: mirar el menú sin pedir nada. */}
          <BotonModo
            activo={modo === "menu"}
            onClick={() => setModo("menu")}
            icono={<BookOpen className="h-6 w-6" />}
            titulo="Menú"
            detalle="Solo mirar"
            accent={accent}
          />
        </div>

        {modo === "envio" && (
          <section className="space-y-3">
            <h2 className="font-bold">¿A dónde te lo llevamos?</h2>
            <BuscadorDireccion cerca={cerca} onElegir={setLugar} />
            {lugar &&
              (opcionesEnvio.length === 0 ? (
                <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  No llegamos a esa dirección desde ninguna sucursal.
                  {hayRetiro && (
                    <button
                      type="button"
                      onClick={() => setModo("retiro")}
                      className="mt-2 block font-bold underline underline-offset-4"
                    >
                      Ver dónde retirar
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {opcionesEnvio.length === 1
                      ? "Te llega desde esta sucursal:"
                      : "Te llegan desde estas sucursales. Elegí una:"}
                  </p>
                  <ul className="space-y-2">
                    {opcionesEnvio.map(({ s, km, cotizacion, horario }) => (
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
                          onClick={() => elegir(s, "envio")}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ))}
          </section>
        )}

        {modo === "retiro" && (
          <section className="space-y-3">
            <h2 className="font-bold">¿Dónde lo retirás?</h2>
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
                        onClick={() => elegir(s, "mostrador")}
                      />
                    </li>
                  );
                })}
            </ul>
          </section>
        )}
        {modo === "menu" && (
          <section className="space-y-3">
            <h2 className="font-bold">¿De qué sucursal querés ver el menú?</h2>
            <ul className="space-y-2">
              {empresa.sucursales.map((s) => (
                <li key={s.slug}>
                  <FilaSucursal
                    nombre={s.name}
                    detalle={s.address ?? "Ver el menú"}
                    abierta
                    abre={null}
                    accent={accent}
                    onClick={() =>
                      void navigate({
                        to: "/p/$empresa/$local",
                        params: { empresa: empresa.slug, local: s.slug },
                        search: { ver: true },
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function BotonModo({
  activo,
  onClick,
  icono,
  titulo,
  detalle,
  accent,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex flex-col items-center gap-1 rounded-3xl border-2 px-2 py-4 transition ${
        activo ? "text-white" : "border-border bg-card/40"
      }`}
      style={activo ? { background: accent, borderColor: accent } : undefined}
    >
      {icono}
      <span className="font-display text-xl">{titulo}</span>
      <span className={`text-xs ${activo ? "opacity-90" : "text-muted-foreground"}`}>
        {detalle}
      </span>
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
          <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-amber-300">
            <Clock className="h-3.5 w-3.5" /> Cerrada · abre {abre}
          </span>
        )}
      </span>
      {abierta && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </button>
  );
}
