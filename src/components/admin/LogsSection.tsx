import { Fragment, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listLogs, type LogRow } from "@/lib/api/logs.functions";

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function LogsSection() {
  const fetchLogs = useServerFn(listLogs);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      setRows(await fetchLogs());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = busca.trim().toLowerCase();
  const filtradas = q
    ? rows.filter((r) =>
        [r.context, r.message, r.companyName, r.locationName, r.userEmail]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q)),
      )
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display text-2xl">Errores del sistema</h2>
          <p className="text-sm text-muted-foreground">
            Excepciones y fallos, por empresa y sucursal. Se purgan solos a los 90 días.
          </p>
        </div>
        <Button
          variant="outline"
          className="ml-auto gap-2"
          onClick={() => void cargar()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refrescar
        </Button>
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por contexto, mensaje, empresa, sucursal o usuario…"
        className="max-w-md"
      />

      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-border p-10 text-center text-muted-foreground">
          No hay errores registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Contexto</th>
                <th className="px-3 py-2">Mensaje</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Sucursal</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-border/60 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {cuando(r.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.context}</td>
                    <td className="px-3 py-2">{r.message}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {r.companyName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {r.locationName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {r.userEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {(r.stack || r.extra) && (
                        <button
                          type="button"
                          onClick={() => setAbierto((a) => (a === r.id ? null : r.id))}
                          className="text-muted-foreground transition hover:text-foreground"
                          aria-label="Ver detalle"
                        >
                          {abierto === r.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {abierto === r.id && (r.stack || r.extra) && (
                    <tr className="border-t border-border/30 bg-black/30">
                      <td colSpan={7} className="px-3 py-3">
                        {r.extra && (
                          <pre className="mb-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                            {r.extra}
                          </pre>
                        )}
                        {r.stack && (
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-tight text-muted-foreground">
                            {r.stack}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
