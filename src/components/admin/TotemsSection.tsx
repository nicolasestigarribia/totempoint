import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Loader2, Plus, Trash2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TotemLinkCard, TotemTabletTips } from "@/components/admin/TotemLinkCard";
import { TotemPrinterCard } from "@/components/admin/TotemPrinterCard";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import {
  listTotems,
  createTotem,
  setTotemActive,
  deleteTotem,
  type TotemRow,
} from "@/lib/api/totems.functions";
import type { MyBusiness } from "@/lib/api/business.functions";

export function TotemsSection({
  panelClass,
  business,
  onEditPortada,
}: {
  panelClass: string;
  business: MyBusiness;
  onEditPortada: () => void;
}) {
  const fetchLocations = useServerFn(listLocations);
  const fetchTotems = useServerFn(listTotems);
  const doCreate = useServerFn(createTotem);
  const doSetActive = useServerFn(setTotemActive);
  const doDelete = useServerFn(deleteTotem);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [totems, setTotems] = useState<TotemRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const reload = async (locId: number) => {
    setLoadingData(true);
    try {
      setTotems(await fetchTotems({ data: { locationId: locId } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los tótems");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (locationId === null) return;
    void reload(locationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const location = locations.find((l) => l.id === locationId) ?? null;

  const handleCreate = async () => {
    if (locationId === null) return;
    setCreating(true);
    try {
      await doCreate({ data: { locationId } });
      await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el tótem");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (t: TotemRow, next: boolean) => {
    setTotems((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: next } : x)));
    try {
      await doSetActive({ data: { id: t.id, active: next } });
    } catch (err) {
      setTotems((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !next } : x)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const handleDelete = async (t: TotemRow) => {
    if (!window.confirm(`¿Eliminar el tótem #${t.number}?`)) return;
    try {
      await doDelete({ data: { id: t.id } });
      if (locationId !== null) await reload(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={onEditPortada}>
            <Monitor className="h-4 w-4" />
            Editar portada
          </Button>
          <Button className="gap-2" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar tótem
          </Button>
        </div>
      </div>

      <TotemTabletTips panelClass={panelClass} />

      {loadingData ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          {totems.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-bold">
                  Tótem #{t.number}
                  {t.label ? ` — ${t.label}` : ""}
                </h3>
                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={`text-xs ${t.active ? "text-green-400" : "text-muted-foreground"}`}
                  >
                    {t.active ? "Activo" : "Inactivo"}
                  </span>
                  <Switch checked={t.active} onCheckedChange={(v) => toggleActive(t, v)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(t)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {location && (
                <>
                  <TotemLinkCard
                    empresa={business.slug}
                    local={location.slug}
                    totem={t.number}
                    panelClass={panelClass}
                  />
                  <TotemPrinterCard
                    totemId={t.id}
                    empresa={business.slug}
                    local={location.slug}
                    totem={t.number}
                    companyName={business.name}
                    dbPrinterName={t.printerName}
                    panelClass={panelClass}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
