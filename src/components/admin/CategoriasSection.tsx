import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useReadOnly } from "@/components/admin/readonly";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  setCategoryActive,
  type CategoryRow,
} from "@/lib/api/categories.functions";

export function CategoriasSection({ panelClass }: { panelClass: string }) {
  const readOnly = useReadOnly();
  const list = useServerFn(listCategories);
  const create = useServerFn(createCategory);
  const update = useServerFn(updateCategory);
  const remove = useServerFn(deleteCategory);
  const toggleActiveFn = useServerFn(setCategoryActive);

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [sort, setSort] = useState("0");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activos" | "inactivos">("todos");

  async function load() {
    setLoading(true);
    try {
      const data = await list();
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setTagline("");
    setPhotoUrl("");
    setSort("0");
    setActive(true);
    setDialogOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setEditing(row);
    setName(row.name);
    setTagline(row.tagline ?? "");
    setPhotoUrl(row.photoUrl ?? "");
    setSort(String(row.sort));
    setActive(row.active);
    setDialogOpen(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre es requerido");
      return;
    }
    const sortValue = Number.parseInt(sort, 10);
    const safeSort = Number.isNaN(sortValue) ? 0 : sortValue;

    setSaving(true);
    try {
      if (editing) {
        await update({
          data: {
            id: editing.id,
            name: trimmed,
            tagline: tagline.trim(),
            photoUrl: photoUrl.trim(),
            sort: safeSort,
            active,
          },
        });
        toast.success("Categoría actualizada");
      } else {
        await create({
          data: {
            name: trimmed,
            tagline: tagline.trim(),
            photoUrl: photoUrl.trim(),
            sort: safeSort,
          },
        });
        toast.success("Categoría creada");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la categoría");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: CategoryRow) {
    if (!window.confirm(`¿Eliminar la categoría "${row.name}"?`)) return;
    setDeletingId(row.id);
    try {
      await remove({ data: { id: row.id } });
      toast.success("Categoría eliminada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la categoría");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(row: CategoryRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      await toggleActiveFn({ data: { id: row.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold">Categorías</h3>
        {!readOnly && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        )}
      </div>

      <DataTable<CategoryRow>
        rows={rows}
        loading={loading}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        pageSize={10}
        initialSort={{ key: "sort", dir: "asc" }}
        searchKeys={[(r) => r.name]}
        searchPlaceholder="Buscar categoría..."
        emptyMessage="No hay categorías todavía."
        emptyIcon={<FolderTree className="h-8 w-8 opacity-40" />}
        filter={(r) =>
          estadoFilter === "todos" ? true : estadoFilter === "activos" ? r.active : !r.active
        }
        toolbar={
          <Select
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}
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
        columns={(
          [
            {
              key: "name",
              header: "Nombre",
              sortable: true,
              sortAccessor: (r) => r.name.toLowerCase(),
              cell: (r) => <span className="font-medium">{r.name}</span>,
            },
            {
              key: "sort",
              header: "Orden",
              sortable: true,
              sortAccessor: (r) => r.sort,
              cell: (r) => <span className="text-muted-foreground">{r.sort}</span>,
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
                    disabled={readOnly}
                    aria-label={r.active ? "Desactivar" : "Activar"}
                  />
                  <span
                    className={`text-xs ${r.active ? "text-green-400" : "text-muted-foreground"}`}
                  >
                    {r.active ? "Activa" : "Inactiva"}
                  </span>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Acción",
              align: "right",
              cell: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(r)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    aria-label="Eliminar"
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-400" />
                    )}
                  </Button>
                </div>
              ),
            },
          ] satisfies Column<CategoryRow>[]
        ).filter((c) => !readOnly || c.key !== "actions")}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nombre</Label>
              <Input
                id="category-name"
                value={name}
                maxLength={80}
                placeholder="Ej: Bebidas"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-tagline">Bajada</Label>
              <Input
                id="category-tagline"
                value={tagline}
                maxLength={60}
                placeholder="Ej: Bien frías"
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>
            <ImageUploadField
              id="category-photo"
              label="Foto de la categoría"
              value={photoUrl}
              onChange={setPhotoUrl}
            />
            <div className="space-y-2">
              <Label htmlFor="category-sort">Orden</Label>
              <Input
                id="category-sort"
                type="number"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  id="category-active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-primary"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <Label htmlFor="category-active" className="cursor-pointer">
                  Activa
                </Label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
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
    </div>
  );
}
