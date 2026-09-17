import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getPlatformRevenue, type CompanyRevenueRow } from "@/lib/api/platform.functions";

type PeriodId = "hoy" | "7" | "30" | "mes" | "todo";

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7", label: "Últimos 7 días" },
  { id: "30", label: "Últimos 30 días" },
  { id: "mes", label: "Mes actual" },
  { id: "todo", label: "Todo" },
];

/** Desde cuándo contar. `null` = sin límite (todo). */
function rangeFor(period: PeriodId): string | null {
  const now = new Date();
  switch (period) {
    case "hoy": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "7":
    case "30": {
      const d = new Date(now);
      d.setDate(d.getDate() - Number(period));
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "mes":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "todo":
      return null;
  }
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function FacturacionSection() {
  const fetchRevenue = useServerFn(getPlatformRevenue);

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodId>("30");
  const [rows, setRows] = useState<CompanyRevenueRow[]>([]);

  const load = useCallback(
    async (p: PeriodId) => {
      setLoading(true);
      try {
        setRows(await fetchRevenue({ data: { from: rangeFor(p), to: null } }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la facturación");
      } finally {
        setLoading(false);
      }
    },
    [fetchRevenue],
  );

  useEffect(() => {
    load(period);
  }, [load, period]);

  const totals = useMemo(() => {
    const total = rows.reduce((n, r) => n + Number(r.total), 0);
    const count = rows.reduce((n, r) => n + r.orders, 0);
    return { total, count, avg: count > 0 ? total / count : 0 };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Pedidos de todas las empresas en el período elegido.
        </p>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodId)}>
          <SelectTrigger className="h-11 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Facturado", value: money.format(totals.total) },
          { label: "Pedidos", value: String(totals.count) },
          { label: "Ticket promedio", value: money.format(totals.avg) },
        ].map((t) => (
          <div key={t.label} className="rounded-3xl border border-border bg-card p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.label}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-4 md:px-6">Negocio</th>
              <th className="px-4 py-4 text-right md:px-6">Pedidos</th>
              <th className="px-4 py-4 text-right md:px-6">Facturado</th>
              <th className="hidden px-6 py-4 text-right md:table-cell">Ticket prom.</th>
              <th className="hidden px-6 py-4 text-right lg:table-cell">Último pedido</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Todavía no hay negocios.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-4 md:px-6">
                    <p className="font-semibold">{r.name}</p>
                    <code className="text-xs text-muted-foreground">{r.slug}</code>
                    {!r.active && <span className="ml-2 text-xs text-destructive">inactivo</span>}
                  </td>
                  <td className="px-4 py-4 text-right md:px-6">{r.orders}</td>
                  <td className="px-4 py-4 text-right font-semibold md:px-6">
                    {money.format(Number(r.total))}
                  </td>
                  <td className="hidden px-6 py-4 text-right text-muted-foreground md:table-cell">
                    {money.format(Number(r.avgTicket))}
                  </td>
                  <td className="hidden px-6 py-4 text-right text-muted-foreground lg:table-cell">
                    {formatDate(r.lastOrderAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Cuenta todos los pedidos registrados: todavía no hay forma de pago ni cancelaciones, así que
        no se puede separar efectivo de Mercado Pago ni descontar un pedido anulado.
      </p>
    </div>
  );
}
