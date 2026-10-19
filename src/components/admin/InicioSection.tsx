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
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrConLogo } from "@/components/QrConLogo";
import { BienvenidaPanel } from "@/components/admin/BienvenidaPanel";
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
  sinBienvenida = false,
}: {
  panelClass: string;
  /** Abre una sección del panel. */
  onIr: (seccion: string) => void;
  puedeComandera: boolean;
  /** El superadmin visitando la empresa: la bienvenida es para el dueño. */
  sinBienvenida?: boolean;
}) {
  const fetchInicio = useServerFn(getInicio);
  const [datos, setDatos] = useState<Inicio | null>(null);
  const [origin, setOrigin] = useState("");
  const [bienvenida, setBienvenida] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchInicio()
      .then((d) => {
        setDatos(d);
        // La bienvenida, la primera vez que el dueño entra desde este navegador.
        try {
          if (d.pasos && !sinBienvenida && !localStorage.getItem("panel-bienvenida-vista")) {
            setBienvenida(true);
          }
        } catch {
          // Sin almacenamiento: no se muestra sola; queda el link para verla.
        }
      })
      .catch((err) => toast.error(mensajeDeError(err, "No se pudo cargar el inicio")));
  }, [fetchInicio, sinBienvenida]);

  const cerrarBienvenida = () => {
    setBienvenida(false);
    try {
      localStorage.setItem("panel-bienvenida-vista", "1");
    } catch {
      // Sin almacenamiento: vuelve a aparecer la próxima vez.
    }
  };

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
      {datos.pasos && (
        <BienvenidaPanel
          abierta={bienvenida}
          empresa={datos.empresa}
          modulos={datos.modulos}
          tieneProductos={datos.pasos.some((p) => p.id === "productos" && p.listo)}
          onCerrar={cerrarBienvenida}
          onIr={(s) => s !== "inicio" && onIr(s)}
        />
      )}
      {datos.hoy && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Dato icono={<Receipt className="h-5 w-5" />} titulo="Pedidos hoy">
            {datos.hoy.pedidos}
          </Dato>
          <Dato
            icono={<Wallet className="h-5 w-5" />}
            titulo="Vendido hoy"
            accion={<ContraSemanaPasada hoy={datos.hoy.vendido} antes={datos.hoy.semanaPasada} />}
          >
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

      {datos.agotados && datos.agotados.length > 0 && (
        <AvisoAgotados agotados={datos.agotados} onIr={() => onIr("stock")} />
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
            {datos.pasos && (
              <Atajo
                icono={<Sparkles className="h-5 w-5" />}
                titulo="Ver la bienvenida de nuevo"
                onClick={() => setBienvenida(true)}
              />
            )}
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

/**
 * Lo que se agotó deja de mostrarse solo en el menú, y el dueño no se entera
 * hasta que un cliente pregunta. Acá lo ve al entrar.
 */
function AvisoAgotados({
  agotados,
  onIr,
}: {
  agotados: { producto: string; sucursal: string }[];
  onIr: () => void;
}) {
  const variasSucursales = new Set(agotados.map((a) => a.sucursal)).size > 1;
  const visibles = agotados.slice(0, 12);
  return (
    <section className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="h-5 w-5" />
            {agotados.length === 1
              ? "1 producto agotado no se está mostrando"
              : `${agotados.length} productos agotados no se están mostrando`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se esconden solos del menú cuando no hay stock. Si ya repusiste, cargalo y vuelven.
          </p>
        </div>
        <button
          type="button"
          onClick={onIr}
          className="h-10 rounded-xl border border-amber-500/50 px-4 text-sm font-bold text-amber-200 transition hover:bg-amber-500/10"
        >
          Cargar stock
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibles.map((a) => (
          <span
            key={`${a.sucursal}-${a.producto}`}
            className="rounded-full bg-card/60 px-3 py-1 text-xs font-bold"
          >
            {a.producto}
            {variasSucursales && (
              <span className="font-normal text-muted-foreground"> · {a.sucursal}</span>
            )}
          </span>
        ))}
        {agotados.length > visibles.length && (
          <span className="px-2 py-1 text-xs text-muted-foreground">
            y {agotados.length - visibles.length} más
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * Cómo viene el día contra el mismo día de la semana pasada a esta hora. Un
 * número solo ("$85.000") no dice si es mucho o poco; comparado, sí.
 */
function ContraSemanaPasada({ hoy, antes }: { hoy: number; antes: number | null }) {
  if (antes === null) return null;
  const dia = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("es-AR", {
    weekday: "long",
  });
  const cambio = Math.round(((hoy - antes) / antes) * 100);
  const sube = cambio >= 0;
  return (
    <p
      className={`text-xs font-bold ${sube ? "text-emerald-400" : "text-amber-400"}`}
      title={`El ${dia} pasado, a esta hora, llevabas ${formatPrice(antes)}`}
    >
      {sube ? "▲" : "▼"} {Math.abs(cambio)}%{" "}
      <span className="font-normal text-muted-foreground">vs. el {dia} pasado</span>
    </p>
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
