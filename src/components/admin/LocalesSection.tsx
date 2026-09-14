import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/admin/DataTable";
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  setLocationActive,
  type LocationRow,
} from "@/lib/api/locations.functions";

export function LocalesSection({ panelClass }: { panelClass: string }) {
  const fetchLocations = useServerFn(listLocations);
  const create = useServerFn(createLocation);
  const update = useServerFn(updateLocation);
  const remove = useServerFn(deleteLocation);
  const toggleActiveFn = useServerFn(setLocationActive);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LocationRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<LocationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activos" | "inactivos">("todos");

  const reload = async () => {
    try {
      const data = await fetchLocations();
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los locales");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchLocations();
        if (mounted) setRows(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los locales");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchLocations]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAddress("");
    setPhone("");
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (row: LocationRow) => {
    setEditing(row);
    setName(row.name);
    setAddress(row.address ?? "");
    setPhone(row.phone ?? "");
    setActive(row.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update({
          data: {
            id: editing.id,
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            active,
          },
        });
        toast.success("Local actualizado");
      } else {
        await create({
          data: {
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
          },
        });
        toast.success("Local creado");
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el local");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await remove({ data: { id: toDelete.id } });
      toast.success("Local eliminado");
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el local");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (row: LocationRow, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      await toggleActiveFn({ data: { id: row.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const columns: Column<LocationRow>[] = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "address",
      header: "Dirección",
      sortable: true,
      sortAccessor: (r) => (r.address ?? "").toLowerCase(),
      cell: (r) => <span className="text-muted-foreground">{r.address ?? "—"}</span>,
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (r) => <span className="text-muted-foreground">{r.phone ?? "—"}</span>,
    },
    {
      key: "active",
      header: "Estado",
      sortable: true,
      sortAccessor: (r) => (r.active ? 1 : 0),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={r.active}
            onCheckedChange={(v) => toggleActive(r, v)}
            aria-label={r.active ? "Desactivar" : "Activar"}
          />
          <span className={`text-xs ${r.active ? "text-green-400" : "text-muted-foreground"}`}>
            {r.active ? "Activo" : "Inactivo"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acción",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row)}
            aria-label="Editar local"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setToDelete(row)}
            aria-label="Eliminar local"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold">Locales</h3>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo local
        </Button>
      </div>

      <DataTable<LocationRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="No hay locales todavía."
        emptyIcon={<MapPin className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.name, (r) => r.address ?? "", (r) => r.phone ?? ""]}
        searchPlaceholder="Buscar local..."
        toolbar={
          <Select
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v as "todos" | "activos" | "inactivos")}
          >
            <SelectTrigger className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="inactivos">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        }
        filter={(r) =>
          estadoFilter === "todos" ? true : estadoFilter === "activos" ? r.active : !r.active
        }
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={10}
      />

      {/* Modal crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar local" : "Nuevo local"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="local-name">Nombre</Label>
              <Input
                id="local-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del local"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-address">Dirección</Label>
              <Input
                id="local-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-phone">Teléfono</Label>
              <Input
                id="local-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                maxLength={40}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="local-active"
                  checked={active}
                  onCheckedChange={(v) => setActive(v === true)}
                />
                <Label htmlFor="local-active" className="cursor-pointer">
                  Activo
                </Label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal confirmación de borrado */}
      <Dialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar local</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar el local{" "}
            <span className="font-medium text-foreground">{toDelete?.name}</span>? Esta acción no se
            puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
