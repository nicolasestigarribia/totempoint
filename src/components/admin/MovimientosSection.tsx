import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, Plus, Loader2, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import { listIngredients, type IngredientRow } from "@/lib/api/ingredients.functions";
import {
  listMovements,
  createMovement,
  listActionCodes,
  type MovementListRow,
} from "@/lib/api/movements.functions";
import {
  actionLabel,
  manualCodes,
  getActionCode,
  type MovementType,
  type ActionCode,
} from "@/lib/actionCodes";

export function MovimientosSection({ panelClass }: { panelClass: string }) {
  const fetchLocations = useServerFn(listLocations);
  const fetchIngredients = useServerFn(listIngredients);
  const fetchMovements = useServerFn(listMovements);
  const fetchCodes = useServerFn(listActionCodes);
  const doCreate = useServerFn(createMovement);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [codes, setCodes] = useState<ActionCode[]>([]);
  const [rows, setRows] = useState<MovementListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [locationFilter, setLocationFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | "stock" | "caja">("todos");

  // Dialog nuevo movimiento
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mType, setMType] = useState<MovementType>("stock");
  const [mLocation, setMLocation] = useState("");
  const [mCode, setMCode] = useState("");
  const [mIngredient, setMIngredient] = useState("");
  const [mIngredientSearch, setMIngredientSearch] = useState("");
  const [mQty, setMQty] = useState("");
  const [mDetail, setMDetail] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredIngredients = useMemo(() => {
    const q = mIngredientSearch.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, mIngredientSearch]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [locs, ings, cds] = await Promise.all([
          fetchLocations(),
          fetchIngredients(),
          fetchCodes(),
        ]);
        if (!mounted) return;
        setLocations(locs);
        setIngredients(ings);
        setCodes(cds);
      } catch {
        /* noop */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchLocations, fetchIngredients, fetchCodes]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchMovements({
          data: {
            locationId: locationFilter === "todos" ? null : Number(locationFilter),
            type: typeFilter === "todos" ? null : typeFilter,
          },
        });
        if (mounted) setRows(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los movimientos");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchMovements, locationFilter, typeFilter, refreshKey]);

  const openCreate = () => {
    setMType("stock");
    setMLocation(locations[0] ? String(locations[0].id) : "");
    const first = manualCodes(codes, "stock")[0];
    setMCode(first ? first.code : "");
    setMIngredient("");
    setMIngredientSearch("");
    setMQty("");
    setMDetail("");
    setDialogOpen(true);
  };

  const onChangeType = (t: MovementType) => {
    setMType(t);
    const first = manualCodes(codes, t)[0];
    setMCode(first ? first.code : "");
    if (t === "caja") {
      setMIngredient("");
      setMIngredientSearch("");
    }
  };

  const handleCreate = async () => {
    const qty = Number(mQty);
    if (!mLocation) {
      toast.error("Elegí un local");
      return;
    }
    if (!mCode) {
      toast.error("Elegí un motivo");
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    if (mType === "stock" && !mIngredient) {
      toast.error("Elegí un ingrediente");
      return;
    }
    setSaving(true);
    try {
      await doCreate({
        data: {
          locationId: Number(mLocation),
          actionCode: mCode,
          ingredientId: mType === "stock" ? Number(mIngredient) : null,
          quantity: qty,
          detail: mDetail.trim() || null,
        },
      });
      toast.success("Movimiento registrado");
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<MovementListRow>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Fecha",
        sortable: true,
        sortAccessor: (r) => r.createdAt,
        cell: (r) => (
          <span className="text-muted-foreground">
            {new Date(r.createdAt).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        key: "location",
        header: "Local",
        sortable: true,
        sortAccessor: (r) => r.locationName ?? "",
        cell: (r) => r.locationName ?? "—",
      },
      {
        key: "type",
        header: "Tipo",
        sortable: true,
        sortAccessor: (r) => r.type,
        cell: (r) => (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              r.type === "stock"
                ? "bg-sky-500/15 text-sky-400"
                : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {r.type === "stock" ? "Stock" : "Caja"}
          </span>
        ),
      },
      {
        key: "ingredient",
        header: "Ítem",
        sortable: true,
        sortAccessor: (r) => r.ingredientName ?? r.productName ?? "",
        cell: (r) => (
          <span className="text-muted-foreground">
            {r.ingredientName ?? r.productName ?? "—"}
            {r.productName && !r.ingredientName ? (
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                Reventa
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "code",
        header: "Motivo",
        sortable: true,
        sortAccessor: (r) => r.actionCode,
        cell: (r) => actionLabel(codes, r.actionCode),
      },
      {
        key: "amount",
        header: "Cantidad",
        sortable: true,
        sortAccessor: (r) => Number(r.amount),
        align: "right",
        cell: (r) => (
          <span className={Number(r.amount) < 0 ? "font-semibold text-amber-400" : "font-semibold text-green-400"}>
            {Number(r.amount) >= 0 ? "+" : ""}
            {r.amount}
          </span>
        ),
      },
      {
        key: "detail",
        header: "Detalle",
        cell: (r) => <span className="text-muted-foreground">{r.detail ?? "—"}</span>,
      },
    ],
    [codes],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold">Movimientos</h3>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Label className="text-sm text-muted-foreground">Local:</Label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="h-10 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los locales</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="h-10 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Stock y Caja</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="caja">Caja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable<MovementListRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="No hay movimientos."
        emptyIcon={<ScrollText className="h-8 w-8 opacity-40" />}
        searchKeys={[
          (r) => r.ingredientName ?? "",
          (r) => r.productName ?? "",
          (r) => r.detail ?? "",
          (r) => actionLabel(codes, r.actionCode),
          (r) => r.locationName ?? "",
        ]}
        searchPlaceholder="Buscar por ítem, motivo, detalle..."
        initialSort={{ key: "date", dir: "desc" }}
        pageSize={15}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={mType} onValueChange={(v) => onChangeType(v as MovementType)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Select value={mLocation} onValueChange={setMLocation}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Elegí un local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={mCode} onValueChange={setMCode}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Elegí un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {manualCodes(codes, mType).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label} · {c.direction === "ingreso" ? "ingreso (+)" : "egreso (−)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mType === "stock" && (
              <div className="space-y-2">
                <Label>Ingrediente</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={mIngredientSearch}
                    placeholder="Buscar ingrediente..."
                    className="h-10 pl-9"
                    onChange={(e) => setMIngredientSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 divide-y divide-white/5 overflow-auto rounded-md border border-white/10">
                  {filteredIngredients.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {ingredients.length === 0 ? "No hay ingredientes" : "Sin resultados"}
                    </p>
                  ) : (
                    filteredIngredients.map((i) => {
                      const selected = mIngredient === String(i.id);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setMIngredient(String(i.id))}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                            selected ? "bg-primary/10 text-foreground" : ""
                          }`}
                        >
                          <span>
                            {i.name}
                            {i.unit ? (
                              <span className="ml-1 text-xs text-muted-foreground">({i.unit})</span>
                            ) : null}
                          </span>
                          {selected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mov-qty">Cantidad</Label>
                <Input
                  id="mov-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  value={mQty}
                  onChange={(e) => setMQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Efecto</Label>
                <div className="flex h-10 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm">
                  {(() => {
                    const def = getActionCode(codes, mCode);
                    if (!def || !mQty) return <span className="text-muted-foreground">—</span>;
                    const signed = (def.direction === "egreso" ? -1 : 1) * Number(mQty);
                    return (
                      <span className={signed < 0 ? "text-amber-400" : "text-green-400"}>
                        {signed >= 0 ? "+" : ""}
                        {signed}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-detail">Detalle (opcional)</Label>
              <Input
                id="mov-detail"
                value={mDetail}
                maxLength={255}
                placeholder="Aclaración, nº de remito, a qué local, etc."
                onChange={(e) => setMDetail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
