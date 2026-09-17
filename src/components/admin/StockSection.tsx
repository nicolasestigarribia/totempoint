import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MapPin,
  Loader2,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Plus,
  Search,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { manualCodes, actionLabel, type ActionCode } from "@/lib/actionCodes";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import {
  getLocationStock,
  getMovements,
  setStockLimit,
  type StockRow,
  type MovementRow,
} from "@/lib/api/stock.functions";
import { createMovement, listActionCodes } from "@/lib/api/movements.functions";

function isLow(r: StockRow): boolean {
  if (r.minStock === null) return false;
  const min = Number(r.minStock);
  return min > 0 && Number(r.stockActual) <= min;
}

// Clave única por fila: ingredientes y productos pueden compartir id numérico.
function rowKey(r: Pick<StockRow, "kind" | "itemId">): string {
  return `${r.kind}:${r.itemId}`;
}

// Payload del ítem para las server fns (ingrediente o producto de reventa).
function itemRef(r: Pick<StockRow, "kind" | "itemId">) {
  return r.kind === "product" ? { productId: r.itemId } : { ingredientId: r.itemId };
}

export function StockSection({ panelClass }: { panelClass: string }) {
  const fetchLocations = useServerFn(listLocations);
  const fetchStock = useServerFn(getLocationStock);
  const doRegister = useServerFn(createMovement);
  const fetchMovements = useServerFn(getMovements);
  const fetchCodes = useServerFn(listActionCodes);
  const saveLimit = useServerFn(setStockLimit);

  const [codes, setCodes] = useState<ActionCode[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const [lowFilter, setLowFilter] = useState<"todos" | "bajo" | "ok">("todos");

  // Dialog de movimiento (ingreso/egreso)
  const [movTarget, setMovTarget] = useState<StockRow | null>(null);
  const [movType, setMovType] = useState<"ingreso" | "egreso">("ingreso");
  const [movQty, setMovQty] = useState("");
  const [movMode, setMovMode] = useState<"unidad" | "bulto">("unidad");
  const [movCode, setMovCode] = useState("");
  const [movDetail, setMovDetail] = useState("");
  const [history, setHistory] = useState<MovementRow[]>([]);
  const [savingMov, setSavingMov] = useState(false);

  // Dialog de mínimo
  const [minTarget, setMinTarget] = useState<StockRow | null>(null);
  const [minValue, setMinValue] = useState("0");
  const [savingMin, setSavingMin] = useState(false);

  // Dialog "nuevo movimiento" (elige ingrediente)
  const [nmOpen, setNmOpen] = useState(false);
  const [nmIngredient, setNmIngredient] = useState<string>("");
  const [nmSearch, setNmSearch] = useState("");
  const [nmCode, setNmCode] = useState("");
  const [nmQty, setNmQty] = useState("");
  const [nmMode, setNmMode] = useState<"unidad" | "bulto">("unidad");
  const [nmDetail, setNmDetail] = useState("");
  const [nmSaving, setNmSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [data, cds] = await Promise.all([fetchLocations(), fetchCodes()]);
        if (!mounted) return;
        setLocations(data);
        setCodes(cds);
        if (data.length > 0) setLocationId(data[0].id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los negocios");
      } finally {
        if (mounted) setLoadingLocations(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchLocations, fetchCodes]);

  const reload = async (locId: number) => {
    setLoadingData(true);
    try {
      setRows(await fetchStock({ data: { locationId: locId } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el stock");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (locationId === null) return;
    void reload(locationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const openMovement = async (r: StockRow, type: "ingreso" | "egreso") => {
    setMovTarget(r);
    setMovType(type);
    setMovQty("");
    setMovMode("unidad");
    setMovCode(manualCodes(codes, "stock", type)[0]?.code ?? "");
    setMovDetail("");
    setHistory([]);
    if (locationId !== null) {
      try {
        setHistory(await fetchMovements({ data: { locationId, ...itemRef(r) } }));
      } catch {
        /* historial opcional */
      }
    }
  };

  const handleRegister = async () => {
    if (!movTarget || locationId === null) return;
    const qty = Number(movQty);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    const upb = Number(movTarget.unitsPerBulk) || 1;
    const baseQty = movMode === "bulto" ? qty * upb : qty;
    setSavingMov(true);
    try {
      await doRegister({
        data: {
          locationId,
          ...itemRef(movTarget),
          actionCode: movCode,
          quantity: baseQty,
          detail: movDetail.trim() || null,
        },
      });
      toast.success(movType === "ingreso" ? "Ingreso registrado" : "Egreso registrado");
      setMovTarget(null);
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setSavingMov(false);
    }
  };

  const openMin = (r: StockRow) => {
    setMinTarget(r);
    setMinValue(r.minStock ?? "0");
  };

  const handleSaveMin = async () => {
    if (!minTarget || locationId === null) return;
    const v = Number(minValue);
    if (Number.isNaN(v) || v < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSavingMin(true);
    try {
      await saveLimit({ data: { ...itemRef(minTarget), minStock: v } });
      toast.success("Mínimo actualizado");
      setMinTarget(null);
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSavingMin(false);
    }
  };

  const openNewMovement = () => {
    setNmIngredient("");
    setNmSearch("");
    setNmCode(manualCodes(codes, "stock")[0]?.code ?? "");
    setNmQty("");
    setNmMode("unidad");
    setNmDetail("");
    setNmOpen(true);
  };

  const nmSelected = rows.find((r) => rowKey(r) === nmIngredient) ?? null;
  const nmFiltered = (() => {
    const q = nmSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  })();

  const handleNewMovement = async () => {
    if (locationId === null) return;
    if (!nmSelected) {
      toast.error("Elegí un ítem");
      return;
    }
    if (!nmCode) {
      toast.error("Elegí un motivo");
      return;
    }
    const qty = Number(nmQty);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    const upb = Number(nmSelected.unitsPerBulk) || 1;
    const baseQty = nmMode === "bulto" ? qty * upb : qty;
    setNmSaving(true);
    try {
      await doRegister({
        data: {
          locationId,
          ...itemRef(nmSelected),
          actionCode: nmCode,
          quantity: baseQty,
          detail: nmDetail.trim() || null,
        },
      });
      toast.success("Movimiento registrado");
      setNmOpen(false);
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setNmSaving(false);
    }
  };

  const columns: Column<StockRow>[] = [
    {
      key: "name",
      header: "Ítem",
      sortable: true,
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.kind === "product" && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
              Reventa
            </span>
          )}
          {isLow(r) && <AlertTriangle className="h-4 w-4 text-amber-400" />}
        </div>
      ),
    },
    {
      key: "unit",
      header: "Unidad",
      cell: (r) => <span className="text-muted-foreground">{r.unit ?? "—"}</span>,
    },
    {
      key: "uxb",
      header: "UxB",
      sortable: true,
      sortAccessor: (r) => Number(r.unitsPerBulk),
      cell: (r) => (
        <span className="text-muted-foreground">
          {Number(r.unitsPerBulk) > 1 ? r.unitsPerBulk : "—"}
        </span>
      ),
    },
    {
      key: "ip",
      header: "Ingresos",
      sortable: true,
      sortAccessor: (r) => Number(r.ipLocal),
      cell: (r) => <span className="text-muted-foreground">{r.ipLocal}</span>,
    },
    {
      key: "vp",
      header: "Ventas",
      sortable: true,
      sortAccessor: (r) => Number(r.vpLocal),
      cell: (r) => <span className="text-muted-foreground">{r.vpLocal}</span>,
    },
    {
      key: "ep",
      header: "Egresos",
      sortable: true,
      sortAccessor: (r) => Number(r.epLocal),
      cell: (r) => <span className="text-muted-foreground">{r.epLocal}</span>,
    },
    {
      key: "stock",
      header: "Stock actual",
      sortable: true,
      sortAccessor: (r) => Number(r.stockActual),
      cell: (r) => (
        <span className={`font-semibold ${isLow(r) ? "text-amber-400" : "text-foreground"}`}>
          {r.stockActual}
        </span>
      ),
    },
    {
      key: "min",
      header: "Mínimo",
      sortable: true,
      sortAccessor: (r) => (r.minStock === null ? -1 : Number(r.minStock)),
      cell: (r) => (
        <button
          type="button"
          onClick={() => openMin(r)}
          className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
        >
          {r.minStock ?? "—"}
          <SlidersHorizontal className="h-3 w-3 opacity-60" />
        </button>
      ),
    },
    {
      key: "actions",
      header: "Mov.",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="icon"
            title="Registrar ingreso"
            aria-label="Registrar ingreso"
            className="h-8 w-8 border-green-500/40 text-green-400 hover:bg-green-500/10"
            onClick={() => openMovement(r, "ingreso")}
          >
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Registrar egreso"
            aria-label="Registrar egreso"
            className="h-8 w-8 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => openMovement(r, "egreso")}
          >
            <ArrowUpFromLine className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loadingLocations) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div
        className={`flex flex-col items-center gap-2 p-10 text-center text-muted-foreground ${panelClass}`}
      >
        <MapPin className="h-8 w-8 opacity-40" />
        <span>Primero creá un negocio en la sección Negocios.</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm text-muted-foreground">Negocio:</Label>
        <Select
          value={locationId === null ? "" : String(locationId)}
          onValueChange={(v) => setLocationId(Number(v))}
        >
          <SelectTrigger className="h-10 w-64">
            <SelectValue placeholder="Elegí un negocio" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Stock = ingresos − ventas − egresos. Ventas se cargan solas al vender; registrá ingresos y
          egresos.
        </p>
        <Button className="ml-auto gap-2" onClick={openNewMovement}>
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <DataTable<StockRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => rowKey(r)}
        panelClass={panelClass}
        loading={loadingData}
        emptyMessage="No hay ítems de stock."
        searchKeys={[(r) => r.name]}
        searchPlaceholder="Buscar ítem..."
        toolbar={
          <Select value={lowFilter} onValueChange={(v) => setLowFilter(v as typeof lowFilter)}>
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="bajo">Bajo stock</SelectItem>
              <SelectItem value="ok">Con stock</SelectItem>
            </SelectContent>
          </Select>
        }
        filter={(r) => (lowFilter === "todos" ? true : lowFilter === "bajo" ? isLow(r) : !isLow(r))}
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={12}
      />

      {/* Dialog registrar movimiento */}
      <Dialog open={movTarget !== null} onOpenChange={(o) => !o && setMovTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {movType === "ingreso" ? "ingreso" : "egreso"} — {movTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mov-qty">Cantidad</Label>
                <Input
                  id="mov-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  value={movQty}
                  autoFocus
                  onChange={(e) => setMovQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ingresar en</Label>
                {movTarget && Number(movTarget.unitsPerBulk) > 1 ? (
                  <Select
                    value={movMode}
                    onValueChange={(v) => setMovMode(v as "unidad" | "bulto")}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad">
                        Unidades{movTarget.unit ? ` (${movTarget.unit})` : ""}
                      </SelectItem>
                      <SelectItem value="bulto">Bultos (x{movTarget.unitsPerBulk})</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-muted-foreground">
                    Unidades {movTarget?.unit ? `(${movTarget.unit})` : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {movMode === "bulto" && movTarget && Number(movTarget.unitsPerBulk) > 1
                  ? `${movQty || 0} bulto(s) = ${(Number(movQty) || 0) * Number(movTarget.unitsPerBulk)} ${movTarget.unit ?? "u."}`
                  : "Stock actual"}
              </span>
              <span className="font-semibold">
                {movMode === "bulto" ? "" : `${movTarget?.stockActual} ${movTarget?.unit ?? ""}`}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={movCode} onValueChange={setMovCode}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {manualCodes(codes, "stock", movType).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mov-detail">Detalle (opcional)</Label>
              <Input
                id="mov-detail"
                value={movDetail}
                maxLength={255}
                placeholder="Aclaración, nº de remito, a qué negocio, etc."
                onChange={(e) => setMovDetail(e.target.value)}
              />
            </div>

            {history.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Últimos movimientos
                </p>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {history.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs"
                    >
                      <span
                        className={m.direction === "ingreso" ? "text-green-400" : "text-amber-400"}
                      >
                        {Number(m.amount) >= 0 ? "+" : ""}
                        {m.amount} · {actionLabel(codes, m.actionCode)}
                      </span>
                      <span className="text-muted-foreground">
                        {m.detail ?? "—"} · {new Date(m.createdAt).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMovTarget(null)} disabled={savingMov}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleRegister} disabled={savingMov}>
              {savingMov && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog mínimo */}
      <Dialog open={minTarget !== null} onOpenChange={(o) => !o && setMinTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mínimo de stock — {minTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="min-value">Mínimo (empresa)</Label>
            <Input
              id="min-value"
              type="number"
              step="0.01"
              min="0"
              value={minValue}
              autoFocus
              onChange={(e) => setMinValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Aplica a todos los negocios. Si el stock actual queda por debajo, se marca como bajo
              stock.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMinTarget(null)} disabled={savingMin}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleSaveMin} disabled={savingMin}>
              {savingMin && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog nuevo movimiento (elige ingrediente) */}
      <Dialog open={nmOpen} onOpenChange={setNmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento de stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ítem (ingrediente o producto de reventa)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={nmSearch}
                  placeholder="Buscar ítem..."
                  className="h-10 pl-9"
                  onChange={(e) => setNmSearch(e.target.value)}
                />
              </div>
              <div className="max-h-40 divide-y divide-white/5 overflow-auto rounded-md border border-white/10">
                {nmFiltered.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Sin resultados
                  </p>
                ) : (
                  nmFiltered.map((i) => {
                    const selected = nmIngredient === rowKey(i);
                    return (
                      <button
                        key={rowKey(i)}
                        type="button"
                        onClick={() => setNmIngredient(rowKey(i))}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                          selected ? "bg-primary/10 text-foreground" : ""
                        }`}
                      >
                        <span>
                          {i.name}
                          {i.unit ? (
                            <span className="ml-1 text-xs text-muted-foreground">({i.unit})</span>
                          ) : null}
                          {i.kind === "product" ? (
                            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                              Reventa
                            </span>
                          ) : null}
                        </span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={nmCode} onValueChange={setNmCode}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Elegí un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {manualCodes(codes, "stock").map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label} · {c.direction === "ingreso" ? "ingreso (+)" : "egreso (−)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nm-qty">Cantidad</Label>
                <Input
                  id="nm-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  value={nmQty}
                  onChange={(e) => setNmQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ingresar en</Label>
                {nmSelected && Number(nmSelected.unitsPerBulk) > 1 ? (
                  <Select value={nmMode} onValueChange={(v) => setNmMode(v as "unidad" | "bulto")}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad">
                        Unidades{nmSelected.unit ? ` (${nmSelected.unit})` : ""}
                      </SelectItem>
                      <SelectItem value="bulto">Bultos (x{nmSelected.unitsPerBulk})</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-10 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-muted-foreground">
                    Unidades {nmSelected?.unit ? `(${nmSelected.unit})` : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nm-detail">Detalle (opcional)</Label>
              <Input
                id="nm-detail"
                value={nmDetail}
                maxLength={255}
                placeholder="Aclaración, nº de remito, a qué negocio, etc."
                onChange={(e) => setNmDetail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNmOpen(false)} disabled={nmSaving}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleNewMovement} disabled={nmSaving}>
              {nmSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
