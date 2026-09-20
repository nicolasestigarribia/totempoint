import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Package, Boxes, Loader2, History, RotateCcw, Pencil } from "lucide-react";
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
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import {
  getLocationPricing,
  setLocationPrice,
  bulkAdjustPrices,
  getPriceHistory,
  type PriceRow,
  type PriceHistoryRow,
} from "@/lib/api/location-prices.functions";

type ItemType = "product" | "combo";
type OverrideFilter = "todos" | "propio" | "base";

interface ChangeTarget {
  itemType: ItemType;
  scope: "all" | "one";
  itemId: number | null; // solo scope === "one"
  itemName?: string;
}

export function PreciosSection({ panelClass }: { panelClass: string }) {
  const fetchLocations = useServerFn(listLocations);
  const fetchPricing = useServerFn(getLocationPricing);
  const savePrice = useServerFn(setLocationPrice);
  const bulkAdjust = useServerFn(bulkAdjustPrices);
  const fetchHistory = useServerFn(getPriceHistory);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [products, setProducts] = useState<PriceRow[]>([]);
  const [combos, setCombos] = useState<PriceRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Filtros
  const [prodOverride, setProdOverride] = useState<OverrideFilter>("todos");
  const [prodCat, setProdCat] = useState<string>("todas");
  const [comboOverride, setComboOverride] = useState<OverrideFilter>("todos");

  // Modal de cambio de precio
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<ChangeTarget | null>(null);
  const [mode, setMode] = useState<"fijo" | "porcentual">("fijo");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Dialog historial
  const [histItem, setHistItem] = useState<{ type: ItemType; id: number; name: string } | null>(
    null,
  );
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchLocations();
        if (!mounted) return;
        setLocations(data);
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
  }, [fetchLocations]);

  const reload = async (locId: number) => {
    setLoadingData(true);
    try {
      const data = await fetchPricing({ data: { locationId: locId } });
      setProducts(data.products);
      setCombos(data.combos);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los precios");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (locationId === null) return;
    void reload(locationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const productCategories = useMemo(
    () => [...new Set(products.map((p) => p.categoryName).filter((n): n is string => !!n))].sort(),
    [products],
  );

  const rowsFor = (t: ItemType) => (t === "product" ? products : combos);

  /**
   * Lo que cada tabla está mostrando después de buscar y filtrar.
   *
   * El cambio masivo trabaja sobre esto y no sobre el catálogo entero: si el
   * dueño filtró por Bebidas para subirlas un 10%, no puede tocarle el precio
   * a los sánguches. Los callbacks van memorizados porque la tabla los usa
   * como dependencia de un efecto.
   */
  const [visibleProducts, setVisibleProducts] = useState<PriceRow[]>([]);
  const [visibleCombos, setVisibleCombos] = useState<PriceRow[]>([]);
  const onVisibleProducts = useCallback((r: PriceRow[]) => setVisibleProducts(r), []);
  const onVisibleCombos = useCallback((r: PriceRow[]) => setVisibleCombos(r), []);
  const visiblesDe = (t: ItemType) => (t === "product" ? visibleProducts : visibleCombos);

  const openBulkModal = (itemType: ItemType) => {
    setTarget({ itemType, scope: "all", itemId: null });
    setMode("fijo");
    setValue("");
    setModalOpen(true);
  };

  const openItemModal = (row: PriceRow) => {
    setTarget({ itemType: row.itemType, scope: "one", itemId: row.itemId, itemName: row.name });
    setMode("fijo");
    setValue("");
    setModalOpen(true);
  };

  const applyChange = async () => {
    if (locationId === null || !target) return;
    const num = Number(value);
    if (Number.isNaN(num)) {
      toast.error("Ingresá un número");
      return;
    }
    if (mode === "fijo" && num < 0) {
      toast.error("El precio no puede ser negativo");
      return;
    }
    if (mode === "porcentual" && num === 0) {
      toast.error("El porcentaje no puede ser 0");
      return;
    }

    const itemIds =
      target.scope === "one" && target.itemId !== null
        ? [target.itemId]
        : visiblesDe(target.itemType).map((r) => r.itemId);
    if (itemIds.length === 0) {
      toast.error("No hay ítems para cambiar");
      return;
    }

    setSaving(true);
    try {
      if (mode === "fijo" && target.scope === "one" && target.itemId !== null) {
        // Precio fijo a un solo ítem: setLocationPrice directo.
        await savePrice({
          data: { locationId, itemType: target.itemType, itemId: target.itemId, price: num },
        });
      } else {
        await bulkAdjust({
          data: {
            locationId,
            itemType: target.itemType,
            itemIds,
            mode: mode === "fijo" ? "unit" : "percent",
            value: num,
          },
        });
      }
      toast.success("Precio actualizado");
      setModalOpen(false);
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el precio");
    } finally {
      setSaving(false);
    }
  };

  const resetToBase = async (row: PriceRow) => {
    if (locationId === null) return;
    try {
      await savePrice({
        data: { locationId, itemType: row.itemType, itemId: row.itemId, price: null },
      });
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo restablecer");
    }
  };

  const openHistory = async (row: PriceRow) => {
    if (locationId === null) return;
    setHistItem({ type: row.itemType, id: row.itemId, name: row.name });
    setHistory([]);
    setLoadingHist(true);
    try {
      const rows = await fetchHistory({
        data: { locationId, itemType: row.itemType, itemId: row.itemId },
      });
      setHistory(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el historial");
    } finally {
      setLoadingHist(false);
    }
  };

  const makeColumns = (showCategory: boolean): Column<PriceRow>[] => {
    const cols: Column<PriceRow>[] = [
      {
        key: "name",
        header: "Nombre",
        sortable: true,
        sortAccessor: (r) => r.name.toLowerCase(),
        cell: (r) => <span className="font-medium">{r.name}</span>,
      },
    ];
    if (showCategory) {
      cols.push({
        key: "category",
        header: "Categoría",
        sortable: true,
        sortAccessor: (r) => (r.categoryName ?? "").toLowerCase(),
        cell: (r) => (
          <span className="text-muted-foreground">{r.categoryName ?? "Sin categoría"}</span>
        ),
      });
    }
    cols.push(
      {
        key: "base",
        header: "Base",
        sortable: true,
        sortAccessor: (r) => Number(r.basePrice),
        cell: (r) => <span className="text-muted-foreground">${r.basePrice}</span>,
      },
      {
        key: "override",
        header: "Propio",
        cell: (r) => (
          <span className="text-muted-foreground">{r.override ? `$${r.override}` : "—"}</span>
        ),
      },
      {
        key: "effective",
        header: "Efectivo",
        sortable: true,
        sortAccessor: (r) => Number(r.effectivePrice),
        cell: (r) => (
          <span className={r.override !== null ? "font-semibold text-primary" : "text-foreground"}>
            ${r.effectivePrice}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Cambiar precio"
              onClick={() => openItemModal(r)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {r.override !== null && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Volver al precio base"
                onClick={() => resetToBase(r)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Historial de cambios"
              onClick={() => openHistory(r)}
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    );
    return cols;
  };

  const productColumns = useMemo(() => makeColumns(true), [locationId]);
  const comboColumns = useMemo(() => makeColumns(false), [locationId]);

  const overrideSelect = (v: OverrideFilter, onChange: (v: OverrideFilter) => void) => (
    <Select value={v} onValueChange={(x) => onChange(x as OverrideFilter)}>
      <SelectTrigger className="h-10 w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        <SelectItem value="propio">Con precio propio</SelectItem>
        <SelectItem value="base">Con precio base</SelectItem>
      </SelectContent>
    </Select>
  );

  const overrideFilterFn = (v: OverrideFilter) => (r: PriceRow) =>
    v === "todos" ? true : v === "propio" ? r.override !== null : r.override === null;

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
    <div className="space-y-6">
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
          El precio de este negocio pisa al precio base.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-bold">Productos</h3>
          </div>
          <Button className="gap-2" onClick={() => openBulkModal("product")}>
            <Pencil className="h-4 w-4" />
            Cambiar precios
          </Button>
        </div>
        <DataTable<PriceRow>
          onVisibleRowsChange={onVisibleProducts}
          rows={products}
          columns={productColumns}
          getRowId={(r) => r.itemId}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay productos."
          searchKeys={[(r) => r.name, (r) => r.categoryName ?? ""]}
          searchPlaceholder="Buscar producto..."
          toolbar={
            <>
              <Select value={prodCat} onValueChange={setProdCat}>
                <SelectTrigger className="h-10 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  <SelectItem value="sin">Sin categoría</SelectItem>
                  {productCategories.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {overrideSelect(prodOverride, setProdOverride)}
            </>
          }
          filter={(r) => {
            const okOv = overrideFilterFn(prodOverride)(r);
            const okCat =
              prodCat === "todas"
                ? true
                : prodCat === "sin"
                  ? r.categoryName === null
                  : r.categoryName === prodCat;
            return okOv && okCat;
          }}
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={10}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-bold">Combos</h3>
          </div>
          <Button className="gap-2" onClick={() => openBulkModal("combo")}>
            <Pencil className="h-4 w-4" />
            Cambiar precios
          </Button>
        </div>
        <DataTable<PriceRow>
          onVisibleRowsChange={onVisibleCombos}
          rows={combos}
          columns={comboColumns}
          getRowId={(r) => r.itemId}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay combos."
          searchKeys={[(r) => r.name]}
          searchPlaceholder="Buscar combo..."
          toolbar={overrideSelect(comboOverride, setComboOverride)}
          filter={overrideFilterFn(comboOverride)}
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={10}
        />
      </div>

      {/* Modal cambiar precio */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar precio</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                {target.scope === "one" ? (
                  <>
                    Ítem: <span className="font-semibold">{target.itemName}</span>
                  </>
                ) : (
                  <>
                    Aplicar a{" "}
                    <span className="font-semibold">
                      {visiblesDe(target.itemType).length}{" "}
                      {target.itemType === "product"
                        ? visiblesDe(target.itemType).length === 1
                          ? "producto"
                          : "productos"
                        : visiblesDe(target.itemType).length === 1
                          ? "combo"
                          : "combos"}
                    </span>
                    {visiblesDe(target.itemType).length < rowsFor(target.itemType).length ? (
                      <>
                        , que es lo que quedó con los filtros que tenés puestos.
                        <p className="mt-1 text-xs text-muted-foreground">
                          El resto del catálogo (
                          {rowsFor(target.itemType).length - visiblesDe(target.itemType).length}{" "}
                          más) no se toca.
                        </p>
                      </>
                    ) : (
                      <> de este negocio: el catálogo completo.</>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de cambio</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "fijo" | "porcentual")}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo">Precio fijo ($)</SelectItem>
                    <SelectItem value="porcentual">Ajuste porcentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price-value">
                  {mode === "fijo" ? "Nuevo precio" : "Porcentaje (ej: 10 sube, -5 baja)"}
                </Label>
                <Input
                  id="price-value"
                  type="number"
                  step="0.01"
                  value={value}
                  autoFocus
                  placeholder={mode === "fijo" ? "0.00" : "10"}
                  onChange={(e) => setValue(e.target.value)}
                />
                {mode === "porcentual" && (
                  <p className="text-xs text-muted-foreground">
                    Se aplica sobre el precio efectivo actual de cada ítem.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button className="gap-2" onClick={applyChange} disabled={saving || !value.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog historial */}
      <Dialog open={histItem !== null} onOpenChange={(o) => !o && setHistItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de precios — {histItem?.name}</DialogTitle>
          </DialogHeader>
          {loadingHist ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin cambios registrados para este negocio.
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span>
                    <span className="text-muted-foreground">
                      {h.oldPrice ? `$${h.oldPrice}` : "—"}
                    </span>
                    {" → "}
                    <span className="font-semibold">${h.newPrice}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {h.userName} · {new Date(h.createdAt).toLocaleString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
