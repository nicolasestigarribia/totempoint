import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, History, Loader2, Search, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAuditLog, type AuditRow } from "@/lib/api/audit.functions";
import { AUDIT_CATEGORIES, AUDIT_CATEGORY_LABEL, type AuditCategory } from "@/lib/audit/categorias";
import { mensajeDeError } from "@/lib/error-message";
import { DateRangeFilter, isoDia, hoyIso } from "@/components/admin/DateRangeFilter";

const TONO: Record<AuditCategory, string> = {
  permisos: "bg-violet-500/15 text-violet-300",
  precios: "bg-amber-500/15 text-amber-300",
  cobros: "bg-emerald-500/15 text-emerald-300",
  pedidos: "bg-destructive/15 text-destructive",
  sucursales: "bg-sky-500/15 text-sky-300",
  empresa: "bg-primary/15 text-primary",
};

function haceUnMes(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return isoDia(d);
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Registro de los cambios críticos del panel: permisos y accesos, precios,
 * cobros, cancelaciones, sucursales y tótems. Es de solo lectura: nadie, ni el
 * dueño, puede editar o borrar una entrada.
 */
export function AuditoriaSection({ panelClass }: { panelClass: string }) {
  const fetchLog = useServerFn(listAuditLog);

  const [desde, setDesde] = useState(haceUnMes());
  const [hasta, setHasta] = useState(hoyIso());
  const [category, setCategory] = useState<AuditCategory | "todas">("todas");
  const [buscar, setBuscar] = useState("");
  const [buscarAplicado, setBuscarAplicado] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<number | null>(null);

  // La búsqueda espera a que se deje de tipear, para no consultar por letra.
  useEffect(() => {
    const t = setTimeout(() => setBuscarAplicado(buscar.trim()), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchLog({
        data: {
          desde,
          hasta,
          category: category === "todas" ? null : category,
          buscar: buscarAplicado || undefined,
        },
      });
      setRows(r.rows);
      setTruncado(r.truncado);
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cargar la auditoría"));
    } finally {
      setLoading(false);
    }
  }, [fetchLog, desde, hasta, category, buscarAplicado]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Quién cambió qué en los puntos sensibles del panel: permisos y accesos, precios, cobros,
          cancelaciones, sucursales y tótems. Las entradas no se pueden editar ni borrar.
        </p>
        <DateRangeFilter
          desde={desde}
          hasta={hasta}
          onChange={(d, h) => {
            setDesde(d);
            setHasta(h);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por usuario, producto, sucursal…"
            className="h-10 pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger className="h-10 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {AUDIT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {AUDIT_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`overflow-hidden ${panelClass}`}>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <History className="mx-auto mb-3 h-8 w-8 opacity-40" />
            No hay cambios registrados con esos filtros.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const expandido = abierto === r.id;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="w-32 shrink-0 text-xs text-muted-foreground">
                      {cuando(r.createdAt)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{r.summary}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${TONO[r.category]}`}
                        >
                          {AUDIT_CATEGORY_LABEL[r.category]}
                        </span>
                        <span>{r.userEmail}</span>
                        {r.asSuperadmin && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <ShieldCheck className="h-3 w-3" />
                            superusuario
                          </span>
                        )}
                      </p>
                    </div>
                    {r.details && (
                      <button
                        type="button"
                        onClick={() => setAbierto(expandido ? null : r.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        Detalle
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${expandido ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                  {expandido && r.details && (
                    <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-muted-foreground">
                      {JSON.stringify(JSON.parse(r.details), null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {truncado && (
        <p className="text-xs text-muted-foreground">
          Se muestran los 300 cambios más recientes. Acortá el rango de fechas o filtrá por
          categoría para ver los anteriores.
        </p>
      )}
    </div>
  );
}
