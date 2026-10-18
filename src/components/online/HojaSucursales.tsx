import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Clock, Loader2, MapPin } from "lucide-react";
import { getOnlineEmpresa, type SucursalOnline } from "@/lib/api/totem.functions";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { CargaMarca } from "@/components/CargaMarca";
import { estadoHorario } from "@/lib/horario";
import { onlineCartKey } from "@/lib/online-menu-cache";
import { llevarCarrito } from "@/lib/online-eleccion";
import { mensajeDeError } from "@/lib/error-message";

/**
 * "Cambiar sucursal" desde el menú: una hoja con las sucursales de la empresa,
 * sin volver a la portada. Al elegir una se abre su menú en la grilla de
 * categorías, con el carrito que ya venía armando (los precios se reajustan
 * solos y lo que ahí no se vende queda marcado). Las cerradas se ven pero no
 * se eligen, igual que en la hoja de Pedir.
 *
 * La lista se pide recién al abrir: la mayoría nunca toca el botón.
 */
export function HojaSucursales({
  abierta,
  onAbierta,
  empresa,
  actual,
  soloVer,
  marca,
}: {
  abierta: boolean;
  onAbierta: (abierta: boolean) => void;
  empresa: string;
  /** El slug de la sucursal en la que está: se marca y no se elige. */
  actual: string;
  /** Mirando el menú sin pedir: la otra sucursal también se abre para mirar. */
  soloVer: boolean;
  marca: { logoUrl: string | null; nombre: string; accent: string };
}) {
  const traer = useServerFn(getOnlineEmpresa);
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState<SucursalOnline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yendo, setYendo] = useState(false);

  useEffect(() => {
    if (!abierta || sucursales) return;
    let vigente = true;
    setError(null);
    traer({ data: { empresa } })
      .then((e) => vigente && setSucursales(e.sucursales))
      .catch((err) => vigente && setError(mensajeDeError(err, "No pudimos traer las sucursales")));
    return () => {
      vigente = false;
    };
  }, [abierta, sucursales, traer, empresa]);

  const elegir = (s: SucursalOnline) => {
    llevarCarrito(empresa, onlineCartKey(empresa, s.slug));
    setYendo(true);
    navigate({
      to: "/p/$empresa/$local",
      params: { empresa, local: s.slug },
      search: soloVer ? { ver: true } : {},
    })
      .then(() => onAbierta(false))
      .finally(() => setYendo(false));
  };

  // Las abiertas primero: el pedido tiene que ir a una que lo prepare ahora.
  const lista = (sucursales ?? [])
    .map((s) => ({ s, h: estadoHorario(s.horarios) }))
    .sort((a, b) => Number(b.h.abierto) - Number(a.h.abierto));

  return (
    <>
      <Drawer
        open={abierta}
        onOpenChange={onAbierta}
        shouldScaleBackground={false}
        // Ver HojaPedir: sin tocar el body, la página no queda trabada.
        noBodyStyles
      >
        <DrawerContent className="max-h-[92svh] totem-tipografia">
          <DrawerDescription className="sr-only">
            Elegí otra sucursal para ver su menú.
          </DrawerDescription>
          <div className="mx-auto min-h-0 w-full max-w-md flex-1 space-y-3 overflow-y-auto px-5 pb-8 pt-4">
            <DrawerTitle className="font-display text-2xl leading-tight">
              ¿De qué sucursal?
            </DrawerTitle>
            {error ? (
              <p className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </p>
            ) : !sucursales ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="space-y-2">
                {lista.map(({ s, h }) => {
                  const esta = s.slug === actual;
                  // Para mirar el menú da igual si está abierta.
                  const elegible = !esta && (soloVer || h.abierto);
                  return (
                    <li key={s.slug}>
                      <button
                        type="button"
                        onClick={() => elegir(s)}
                        disabled={!elegible}
                        className={`flex w-full items-center gap-3 rounded-2xl border bg-card/40 p-4 text-left transition enabled:hover:border-primary ${
                          esta ? "border-2" : "border-border disabled:opacity-50"
                        }`}
                        style={esta ? { borderColor: marca.accent } : undefined}
                      >
                        <MapPin
                          className="h-5 w-5 shrink-0"
                          style={{ color: elegible || esta ? marca.accent : undefined }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{s.name}</span>
                          {s.address && (
                            <span className="block text-sm text-muted-foreground">{s.address}</span>
                          )}
                          {!soloVer && !h.abierto && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-amber-500">
                              <Clock className="h-3.5 w-3.5" /> Cerrada · abre {h.texto}
                            </span>
                          )}
                        </span>
                        {esta ? (
                          <span
                            className="flex shrink-0 items-center gap-1 text-xs font-bold"
                            style={{ color: marca.accent }}
                          >
                            <Check className="h-4 w-4" /> Estás acá
                          </span>
                        ) : (
                          elegible && (
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                          )
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      {yendo && (
        <CargaMarca
          logoUrl={marca.logoUrl}
          nombre={marca.nombre}
          texto="Preparando el menú…"
          accent={marca.accent}
        />
      )}
    </>
  );
}
