import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string | number;
  panelClass: string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  searchKeys?: ((row: T) => string)[];
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  filter?: (row: T) => boolean;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  panelClass,
  loading = false,
  emptyMessage = "No hay datos.",
  emptyIcon,
  searchKeys,
  searchPlaceholder = "Buscar...",
  toolbar,
  filter,
  pageSize = 10,
  initialSort,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort?.dir ?? "asc");
  const [page, setPage] = useState(1);

  const colCount = columns.length;

  const processed = useMemo(() => {
    let out = rows;
    if (filter) out = out.filter(filter);
    const q = query.trim().toLowerCase();
    if (q && searchKeys && searchKeys.length > 0) {
      out = out.filter((r) => searchKeys.some((fn) => fn(r).toLowerCase().includes(q)));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortAccessor) {
        const acc = col.sortAccessor;
        out = [...out].sort((a, b) => {
          const va = acc(a);
          const vb = acc(b);
          if (va < vb) return sortDir === "asc" ? -1 : 1;
          if (va > vb) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }
    return out;
  }, [rows, filter, query, searchKeys, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));

  // Volver a la página 1 si cambia el filtrado/orden o si la página quedó fuera de rango.
  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir, filter, rows]);

  const currentPage = Math.min(page, totalPages);
  const pageRows = processed.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const hasToolbar = Boolean(searchKeys) || Boolean(toolbar);

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          {searchKeys && (
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                placeholder={searchPlaceholder}
                className="h-10 pl-9"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      <div className={`overflow-x-auto ${panelClass}`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-5 py-3 ${c.align === "right" ? "text-right" : ""} ${
                    c.sortable ? "cursor-pointer select-none" : ""
                  }`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      c.align === "right" ? "flex-row-reverse" : ""
                    } ${c.sortable ? "transition hover:text-foreground" : ""}`}
                  >
                    {c.header}
                    {c.sortable &&
                      (sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-5 py-12">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-5 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon}
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={getRowId(row)} className="border-t border-border">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-5 py-3 ${c.align === "right" ? "text-right" : ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && processed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {processed.length} resultado{processed.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
