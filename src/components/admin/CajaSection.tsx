import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Banknote,
  Smartphone,
  CircleDollarSign,
  Ban,
  Clock,
  Trophy,
  Download,
} from "lucide-react";

import {
  getCashClose,
  getMasVendidos,
  exportPedidos,
  LIMITE_PLANILLA,
  type CashClose,
  type MasVendido,
} from "@/lib/api/orders.functions";
import { mensajeDeError } from "@/lib/error-message";
import { DateRangeFilter, hoyJornada } from "@/components/admin/DateRangeFilter";
import { formatearNumeroPedido } from "@/lib/order-number";
import { aCsv, descargarArchivo } from "@/lib/planilla";

function pesos(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Cierre de caja del día: qué se cobró, cómo y qué quedó colgado.
 *
 * Los totales salen solo de lo que alguien marcó como cobrado en la comandera,
 * porque el tótem todavía no cobra. Por eso "pendiente de cobro" está a la
 * vista: casi siempre es un pedido entregado que nadie marcó, y es la
 * diferencia que después no cierra contra la caja.
 */
export function CajaSection({ panelClass }: { panelClass: string }) {
  const fetchClose = useServerFn(getCashClose);
  const fetchMasVendidos = useServerFn(getMasVendidos);
  const fetchPlanilla = useServerFn(exportPedidos);
  const [bajando, setBajando] = useState(false);
  const [masVendidos, setMasVendidos] = useState<MasVendido[]>([]);

  const [desde, setDesde] = useState(hoyJornada());
  const [hasta, setHasta] = useState(hoyJornada());
  const [data, setData] = useState<CashClose | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d: string, h: string) => {
      setLoading(true);
      try {
        const [cierre, ranking] = await Promise.all([
          fetchClose({ data: { desde: d, hasta: h } }),
          fetchMasVendidos({ data: { desde: d, hasta: h } }),
        ]);
        setData(cierre);
        setMasVendidos(ranking);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo cargar el cierre de caja"));
      } finally {
        setLoading(false);
      }
    },
    [fetchClose, fetchMasVendidos],
  );

  useEffect(() => {
    load(desde, hasta);
  }, [load, desde, hasta]);

  const unDia = desde === hasta;

  const descargar = async () => {
    setBajando(true);
    try {
      const pedidos = await fetchPlanilla({ data: { desde, hasta } });
      if (pedidos.length >= LIMITE_PLANILLA) {
        toast.warning(
          `Son muchos pedidos: la planilla trae los primeros ${LIMITE_PLANILLA.toLocaleString("es-AR")}. Elegí menos días para tenerlos todos.`,
        );
      }
      if (pedidos.length === 0) {
        toast.info("No hay pedidos en esas fechas");
        return;
      }
      const CANAL = { totem: "Tótem", online: "Online", mesa: "Mesa" } as const;
      const ENTREGA = { local: "Comer en el local", mostrador: "Retiro", envio: "Envío" } as const;
      const COBRO = {
        pendiente: "Sin cobrar",
        pagado: "Cobrado",
        reembolso_pendiente: "A devolver",
      };
      const ESTADO = {
        recibido: "Recibido",
        preparacion: "En preparación",
        entregado: "Entregado",
        cancelado: "Cancelado",
      };
      const csv = aCsv([
        [
          "Jornada",
          "Pedido",
          "Hora",
          "Sucursal",
          "Canal",
          "Entrega",
          "Cliente",
          "Teléfono",
          "Dirección",
          "Forma de pago",
          "Cobro",
          "Estado",
          "Envío",
          "Regalo",
          "Total",
          "Detalle",
        ],
        ...pedidos.map((p) => [
          p.jornada,
          formatearNumeroPedido(p.jornada, p.numero),
          p.hora,
          p.sucursal,
          p.mesa !== null ? `Mesa ${p.mesa}` : CANAL[p.canal],
          ENTREGA[p.entrega],
          p.cliente,
          p.telefono,
          p.direccion,
          p.formaDePago === "efectivo" ? "Efectivo" : "Mercado Pago",
          COBRO[p.cobro],
          ESTADO[p.estado],
          p.envio,
          p.regalo,
          p.total,
          p.detalle,
        ]),
      ]);
      descargarArchivo(`pedidos_${desde}${unDia ? "" : `_a_${hasta}`}.csv`, csv);
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo armar la planilla"));
    } finally {
      setBajando(false);
    }
  };

  const tiles = [
    {
      label: "Cobrado",
      value: pesos(data?.totalCobrado ?? 0),
      icon: CircleDollarSign,
      tone: "text-emerald-400",
      hint: `${data?.pedidos ?? 0} pedidos`,
    },
    {
      label: "Pendiente de cobro",
      value: pesos(data?.totalPendiente ?? 0),
      icon: Clock,
      tone: "text-amber-400",
      hint: "Entregados sin marcar",
    },
    {
      label: "A devolver",
      value: pesos(data?.totalReembolsos ?? 0),
      icon: Ban,
      tone: "text-destructive",
      hint: `${data?.cancelados ?? 0} cancelados`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Tu caja</h3>
          <p className="text-sm text-muted-foreground">
            Lo cobrado {unDia ? "en la jornada" : "en esas jornadas"}, separado por forma de pago.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            porJornada
            desde={desde}
            hasta={hasta}
            onChange={(d, h) => {
              setDesde(d);
              setHasta(h);
            }}
          />
          <button
            type="button"
            onClick={descargar}
            disabled={bajando}
            className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary disabled:opacity-50"
            title="Baja los pedidos de estas fechas en una planilla que abre Excel"
          >
            {bajando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar planilla
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className={`p-5 ${panelClass}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <t.icon className={`h-4 w-4 ${t.tone}`} />
              {t.label}
            </div>
            <p className={`mt-2 font-display text-3xl ${t.tone}`}>{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className={`overflow-hidden ${panelClass}`}>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data || data.lines.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {unDia ? "No hubo pedidos en esta jornada." : "No hubo pedidos en esas fechas."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Sucursal</th>
                  <th className="px-5 py-3 text-right">Efectivo</th>
                  <th className="px-5 py-3 text-right">Mercado Pago</th>
                  <th className="px-5 py-3 text-right">Total cobrado</th>
                  <th className="px-5 py-3 text-right">Pendiente</th>
                  <th className="px-5 py-3 text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.locationId} className="border-t border-border">
                    <td className="px-5 py-4 font-semibold">
                      {l.locationName}
                      {l.cancelados > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {l.cancelados} cancelado{l.cancelados > 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                        {pesos(l.efectivoCobrado)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        {pesos(l.mercadopagoCobrado)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-display text-lg text-emerald-400">
                      {pesos(l.efectivoCobrado + l.mercadopagoCobrado)}
                    </td>
                    <td className="px-5 py-4 text-right text-amber-400">
                      {l.pendienteDeCobro > 0 ? pesos(l.pendienteDeCobro) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right text-muted-foreground">{l.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lo más vendido en esas fechas: lo que todo dueño pregunta primero. */}
      {!loading && masVendidos.length > 0 && (
        <div className={`p-5 ${panelClass}`}>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="h-5 w-5 text-amber-400" /> Lo más vendido
          </h3>
          <ol className="mt-3 space-y-2">
            {masVendidos.map((m, i) => {
              const max = masVendidos[0].unidades || 1;
              return (
                <li key={m.nombre} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-bold text-muted-foreground">{i + 1}.</span>
                      {m.nombre}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      <b className="text-foreground">{m.unidades}</b> u · {pesos(m.total)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(m.unidades / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los totales cuentan lo que se marcó como cobrado en la comandera. Los pedidos cancelados no
        suman: si alguno ya estaba cobrado, aparece en “a devolver” y la plata se devuelve a mano.
      </p>
    </div>
  );
}
