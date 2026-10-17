import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  ChefHat,
  Copy,
  ExternalLink,
  Loader2,
  PartyPopper,
  Receipt,
  ShoppingBag,
  Wallet,
  Package,
  ArrowRight,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrConLogo } from "@/components/QrConLogo";
import { getInicio, type Inicio } from "@/lib/api/inicio.functions";
import { mensajeDeError } from "@/lib/error-message";
import { formatPrice } from "@/lib/totem-cart";

/**
 * La entrada del panel. Contesta lo que pregunta alguien que recién empieza:
 * cómo viene el día, dónde está el link para vender y qué le falta. Cada paso
 * pendiente lleva a la sección donde se hace, así nadie tiene que adivinar en
 * cuál de las dieciséis está.
 */
export function InicioSection({
  panelClass,
  onIr,
  puedeComandera,
}: {
  panelClass: string;
  /** Abre una sección del panel. */
  onIr: (seccion: string) => void;
  puedeComandera: boolean;
}) {
  const fetchInicio = useServerFn(getInicio);
  const [datos, setDatos] = useState<Inicio | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchInicio()
      .then(setDatos)
      .catch((err) => toast.error(mensajeDeError(err, "No se pudo cargar el inicio")));
  }, [fetchInicio]);

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const necesarios = datos.pasos?.filter((p) => !p.opcional) ?? [];
  const listos = necesarios.filter((p) => p.listo).length;
  const todoListo = necesarios.length > 0 && listos === necesarios.length;
  const url = datos.link && origin ? `${origin}${datos.link}` : (datos.link ?? "");
  // Lo que falta arriba —primero lo necesario, después lo opcional— y lo hecho
  // al final: la lista dice qué hacer ahora, no qué ya se hizo.
  const peso = (p: { listo: boolean; opcional: boolean }) => (p.listo ? 2 : p.opcional ? 1 : 0);
  const pasos = [...(datos.pasos ?? [])].sort((a, b) => peso(a) - peso(b));

  return (
    <div className="space-y-6">
      {datos.hoy && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Dato icono={<Receipt className="h-5 w-5" />} titulo="Pedidos hoy">
            {datos.hoy.pedidos}
          </Dato>
          <Dato icono={<Wallet className="h-5 w-5" />} titulo="Vendido hoy">
            {formatPrice(datos.hoy.vendido)}
          </Dato>
          <Dato
            icono={<Bell className="h-5 w-5" />}
            titulo="Por aceptar"
            resaltar={datos.hoy.porAceptar > 0}
            accion={
              puedeComandera ? (
                <a
                  href="/kitchen"
                  className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                >
                  <ChefHat className="h-4 w-4" /> Atender
                </a>
              ) : null
            }
          >
            {datos.hoy.porAceptar}
          </Dato>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {datos.pasos && (
          <section className={`space-y-4 p-6 lg:col-span-3 ${panelClass}`}>
            {todoListo ? (
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-300">
                <PartyPopper className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-bold">¡Tu local ya está listo para vender!</p>
                  <p className="text-sm opacity-90">
                    Compartí tu link. Lo que queda abajo es opcional, para sumar cuando quieras.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold">Dejá tu local listo para vender</h2>
                <p className="text-sm text-muted-foreground">
                  {listos} de {necesarios.length} pasos listos. Tocá cada uno y te llevamos.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(listos / Math.max(necesarios.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <ol className="space-y-2">
              {pasos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onIr(p.seccion)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:border-primary ${
                      p.listo ? "border-border/50 opacity-70" : "border-border bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        p.listo
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "border-2 border-muted-foreground/40"
                      }`}
                    >
                      {p.listo && <Check className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {p.titulo}
                        {p.opcional && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Opcional
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-muted-foreground">{p.detalle}</span>
                    </span>
                    {!p.listo && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className={`space-y-6 ${datos.pasos ? "lg:col-span-2" : "lg:col-span-5"}`}>
          {datos.link && (
            <section className={`space-y-4 p-6 ${panelClass}`}>
              <div>
                <h2 className="text-xl font-bold">Tu link para vender</h2>
                <p className="text-sm text-muted-foreground">
                  Pegalo en Instagram y WhatsApp, o imprimí el QR para el mostrador.
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                <div className="shrink-0 rounded-2xl bg-white p-3">
                  <QrConLogo value={url} size={132} />
                </div>
                <div className="w-full min-w-0 space-y-2">
                  <p className="break-all rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold">
                    {url}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          toast.success("Link copiado");
                        } catch {
                          toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    <a
                      href={datos.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition hover:border-primary"
                    >
                      <ExternalLink className="h-4 w-4" /> Ver como cliente
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className={`space-y-2 p-6 ${panelClass}`}>
            <h2 className="mb-2 text-xl font-bold">Lo de todos los días</h2>
            <Atajo
              icono={<Package className="h-5 w-5" />}
              titulo="Cambiar un precio o pausar un producto"
              onClick={() => onIr("productos")}
            />
            <Atajo
              icono={<ShoppingBag className="h-5 w-5" />}
              titulo="Ver cuánto vendí"
              onClick={() => onIr("caja")}
            />
            {puedeComandera && (
              <a
                href="/kitchen"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/5"
              >
                <ChefHat className="h-5 w-5 text-primary" />
                <span className="flex-1">Atender los pedidos (comandera)</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Dato({
  icono,
  titulo,
  children,
  accion,
  resaltar = false,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
  resaltar?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-3 shadow-lg shadow-black/30 sm:rounded-3xl sm:p-5 ${
        resaltar ? "border-primary/60 bg-primary/10" : "border-white/10 bg-[oklch(0.17_0.015_20)]"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
        <span className="hidden sm:inline">{icono}</span> {titulo}
      </p>
      <p className="mt-1 truncate text-xl font-bold tracking-tight sm:mt-2 sm:text-3xl">
        {children}
      </p>
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

function Atajo({
  icono,
  titulo,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-white/5"
    >
      <span className="text-primary">{icono}</span>
      <span className="flex-1">{titulo}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
