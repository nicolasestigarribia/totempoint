import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Package, Boxes, Loader2, History, RotateCcw, Percent } from "lucide-react";
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
import {
  getLocationPricing,
  setLocationPrice,
  bulkAdjustPrices,
  getPriceHistory,
  type PriceRow,
  type PriceHistoryRow,
} from "@/lib/api/location-prices.functions";

type ItemType = "product" | "combo";

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

  // Ajuste porcentual masivo por tabla.
  const [pctProduct, setPctProduct] = useState("");
  const [pctCombo, setPctCombo] = useState("");
  const [bulking, setBulking] = useState(false);

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

  // Guarda un override (o lo borra si el input queda vacío = vuelve al base).
  const commitPrice = async (row: PriceRow, raw: string) => {
    if (locationId === null) return;
    const trimmed = raw.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (Number.isNaN(price) || price < 0)) {
      toast.error("Precio inválido");
      return;
    }
    // No-op si no cambió.
    const current = row.override ?? "";
    if (trimmed === current) return;
    try {
      await savePrice({ data: { locationId, itemType: row.itemType, itemId: row.itemId, price } });
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
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

  const applyPercent = async (itemType: ItemType, rows: PriceRow[], raw: string) => {
    if (locationId === null) return;
    const value = Number(raw);
    if (Number.isNaN(value) || value === 0) {
      toast.error("Ingresá un porcentaje (ej: 10 o -5)");
      return;
    }
    if (rows.length === 0) return;
    setBulking(true);
    try {
      await bulkAdjust({
        data: {
          locationId,
          itemType,
          itemIds: rows.map((r) => r.itemId),
          mode: "percent",
          value,
        },
      });
      toast.success(`Ajuste de ${value}% aplicado a ${rows.length} ítems`);
      if (itemType === "product") setPctProduct("");
      else setPctCombo("");
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aplicar el ajuste");
    } finally {
      setBulking(false);
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

  const makeColumns = (): Column<PriceRow>[] => [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "base",
      header: "Base",
      sortable: true,
      sortAccessor: (r) => Number(r.basePrice),
      cell: (r) => <span className="text-muted-foreground">${r.basePrice}</span>,
    },
    {
      key: "override",
      header: "Precio en este negocio",
      cell: (r) => (
        <Input
          key={`${r.itemType}-${r.itemId}-${r.override ?? "base"}`}
          type="number"
          step="0.01"
          min="0"
          defaultValue={r.override ?? ""}
          placeholder={r.basePrice}
          className="h-9 w-28"
          onBlur={(e) => commitPrice(r, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
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
  ];

  const productColumns = useMemo(makeColumns, [locationId]);
  const comboColumns = useMemo(makeColumns, [locationId]);

  const bulkBar = (
    itemType: ItemType,
    rows: PriceRow[],
    value: string,
    setValue: (v: string) => void,
  ) => (
    <div className="flex items-center gap-2">
      <Percent className="h-4 w-4 text-muted-foreground" />
      <Input
        type="number"
        step="0.1"
        value={value}
        placeholder="% (ej: 10 / -5)"
        className="h-10 w-36"
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        variant="outline"
        className="gap-2"
        disabled={bulking || !value.trim()}
        onClick={() => applyPercent(itemType, rows, value)}
      >
        {bulking && <Loader2 className="h-4 w-4 animate-spin" />}
        Aplicar a todos
      </Button>
    </div>
  );

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
          El precio de este negocio pisa al precio base. Dejá el campo vacío para volver al base.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-bold">Productos</h3>
          </div>
          {bulkBar("product", products, pctProduct, setPctProduct)}
        </div>
        <DataTable<PriceRow>
          rows={products}
          columns={productColumns}
          getRowId={(r) => r.itemId}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay productos."
          searchKeys={[(r) => r.name]}
          searchPlaceholder="Buscar producto..."
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
          {bulkBar("combo", combos, pctCombo, setPctCombo)}
        </div>
        <DataTable<PriceRow>
          rows={combos}
          columns={comboColumns}
          getRowId={(r) => r.itemId}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay combos."
          searchKeys={[(r) => r.name]}
          searchPlaceholder="Buscar combo..."
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={10}
        />
      </div>

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
                    <span className="text-muted-foreground">{h.oldPrice ? `$${h.oldPrice}` : "—"}</span>
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
