import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, FolderTree, Package, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useReadOnly } from "@/components/admin/readonly";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import {
  getLocationAvailability,
  setCategoryAvailability,
  setProductAvailability,
  type AvailCategory,
  type AvailProduct,
} from "@/lib/api/availability.functions";

export function DisponibilidadSection({ panelClass }: { panelClass: string }) {
  const readOnly = useReadOnly();
  const fetchLocations = useServerFn(listLocations);
  const fetchAvailability = useServerFn(getLocationAvailability);
  const toggleCategory = useServerFn(setCategoryAvailability);
  const toggleProduct = useServerFn(setProductAvailability);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [cats, setCats] = useState<AvailCategory[]>([]);
  const [prods, setProds] = useState<AvailProduct[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const [catAvailFilter, setCatAvailFilter] = useState<"todos" | "disponibles" | "ocultos">(
    "todos",
  );
  const [prodAvailFilter, setProdAvailFilter] = useState<"todos" | "disponibles" | "ocultos">(
    "todos",
  );
  const [prodCatFilter, setProdCatFilter] = useState<string>("todas");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchLocations();
        if (!mounted) return;
        setLocations(data);
        if (data.length > 0) setLocationId(data[0].id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las sucursales");
      } finally {
        if (mounted) setLoadingLocations(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchLocations]);

  useEffect(() => {
    if (locationId === null) return;
    let mounted = true;
    setLoadingData(true);
    (async () => {
      try {
        const data = await fetchAvailability({ data: { locationId } });
        if (!mounted) return;
        setCats(data.categories);
        setProds(data.products);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la disponibilidad");
      } finally {
        if (mounted) setLoadingData(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [locationId, fetchAvailability]);

  const onToggleCategory = async (cat: AvailCategory, next: boolean) => {
    if (locationId === null) return;
    setCats((prev) => prev.map((c) => (c.id === cat.id ? { ...c, available: next } : c)));
    try {
      await toggleCategory({ data: { locationId, categoryId: cat.id, available: next } });
    } catch (err) {
      setCats((prev) => prev.map((c) => (c.id === cat.id ? { ...c, available: !next } : c)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la disponibilidad");
    }
  };

  const onToggleProduct = async (prod: AvailProduct, next: boolean) => {
    if (locationId === null) return;
    setProds((prev) => prev.map((p) => (p.id === prod.id ? { ...p, available: next } : p)));
    try {
      await toggleProduct({ data: { locationId, productId: prod.id, available: next } });
    } catch (err) {
      setProds((prev) => prev.map((p) => (p.id === prod.id ? { ...p, available: !next } : p)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la disponibilidad");
    }
  };

  const categoryNames = useMemo(
    () => [...new Set(prods.map((p) => p.categoryName).filter((n): n is string => !!n))].sort(),
    [prods],
  );

  const availSelect = (
    value: "todos" | "disponibles" | "ocultos",
    onChange: (v: "todos" | "disponibles" | "ocultos") => void,
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v as typeof value)}>
      <SelectTrigger className="h-10 w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        <SelectItem value="disponibles">Disponibles</SelectItem>
        <SelectItem value="ocultos">Ocultos</SelectItem>
      </SelectContent>
    </Select>
  );

  const categoryColumns: Column<AvailCategory>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Categoría",
        sortable: true,
        sortAccessor: (r) => r.name.toLowerCase(),
        cell: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: "available",
        header: "Disponible",
        align: "right",
        cell: (r) => (
          <div className="flex items-center justify-end gap-2">
            <span className={`text-xs ${r.available ? "text-green-400" : "text-muted-foreground"}`}>
              {r.available ? "Disponible" : "Oculta"}
            </span>
            <Switch
              checked={r.available}
              onCheckedChange={(v) => onToggleCategory(r, v)}
              disabled={readOnly}
            />
          </div>
        ),
      },
    ],
    [locationId],
  );

  const productColumns: Column<AvailProduct>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Producto",
        sortable: true,
        sortAccessor: (r) => r.name.toLowerCase(),
        cell: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: "category",
        header: "Categoría",
        sortable: true,
        sortAccessor: (r) => (r.categoryName ?? "").toLowerCase(),
        cell: (r) => (
          <span className="text-muted-foreground">{r.categoryName ?? "Sin categoría"}</span>
        ),
      },
      {
        key: "available",
        header: "Disponible",
        align: "right",
        cell: (r) => (
          <div className="flex items-center justify-end gap-2">
            <span className={`text-xs ${r.available ? "text-green-400" : "text-muted-foreground"}`}>
              {r.available ? "Disponible" : "Oculto"}
            </span>
            <Switch
              checked={r.available}
              onCheckedChange={(v) => onToggleProduct(r, v)}
              disabled={readOnly}
            />
          </div>
        ),
      },
    ],
    [locationId],
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
        <span>Primero creá una sucursal en la sección Sucursales.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm text-muted-foreground">Sucursal:</Label>
        <Select
          value={locationId === null ? "" : String(locationId)}
          onValueChange={(v) => setLocationId(Number(v))}
        >
          <SelectTrigger className="h-10 w-64">
            <SelectValue placeholder="Elegí una sucursal" />
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
          Ocultá categorías o productos solo para esta sucursal (el menú se define a nivel empresa).
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold">Categorías</h3>
        </div>
        <DataTable<AvailCategory>
          rows={cats}
          columns={categoryColumns}
          getRowId={(r) => r.id}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay categorías."
          searchKeys={[(r) => r.name]}
          searchPlaceholder="Buscar categoría..."
          toolbar={availSelect(catAvailFilter, setCatAvailFilter)}
          filter={(r) =>
            catAvailFilter === "todos"
              ? true
              : catAvailFilter === "disponibles"
                ? r.available
                : !r.available
          }
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={10}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold">Productos</h3>
        </div>
        <DataTable<AvailProduct>
          rows={prods}
          columns={productColumns}
          getRowId={(r) => r.id}
          panelClass={panelClass}
          loading={loadingData}
          emptyMessage="No hay productos."
          searchKeys={[(r) => r.name, (r) => r.categoryName ?? ""]}
          searchPlaceholder="Buscar producto..."
          toolbar={
            <>
              <Select value={prodCatFilter} onValueChange={setProdCatFilter}>
                <SelectTrigger className="h-10 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  <SelectItem value="sin">Sin categoría</SelectItem>
                  {categoryNames.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availSelect(prodAvailFilter, setProdAvailFilter)}
            </>
          }
          filter={(r) => {
            const okAvail =
              prodAvailFilter === "todos"
                ? true
                : prodAvailFilter === "disponibles"
                  ? r.available
                  : !r.available;
            const okCat =
              prodCatFilter === "todas"
                ? true
                : prodCatFilter === "sin"
                  ? r.categoryName === null
                  : r.categoryName === prodCatFilter;
            return okAvail && okCat;
          }}
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={10}
        />
      </div>
    </div>
  );
}
