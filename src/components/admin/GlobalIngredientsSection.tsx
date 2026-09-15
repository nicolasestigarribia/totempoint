import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Carrot } from "lucide-react";
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
import {
  listGlobalIngredients,
  createGlobalIngredient,
  updateGlobalIngredient,
  deleteGlobalIngredient,
  type GlobalIngredientRow,
} from "@/lib/api/ingredients.functions";
import {
  listGlobalIngredientCategories,
  type IngredientCategoryRow,
} from "@/lib/api/ingredientcategories.functions";

const UNITS = ["Grs", "Kg", "Mg", "Ml", "Lts", "Cc", "Cm", "Mm", "Mts", "Unidad"] as const;

const PANEL = "rounded-3xl border border-border bg-card shadow-lg";

export function GlobalIngredientsSection() {
  const fetchAll = useServerFn(listGlobalIngredients);
  const fetchCats = useServerFn(listGlobalIngredientCategories);
  const doCreate = useServerFn(createGlobalIngredient);
  const doUpdate = useServerFn(updateGlobalIngredient);
  const doDelete = useServerFn(deleteGlobalIngredient);

  const [rows, setRows] = useState<GlobalIngredientRow[]>([]);
  const [categories, setCategories] = useState<IngredientCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalIngredientRow | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [unitsPerBulk, setUnitsPerBulk] = useState("1");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<GlobalIngredientRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const [data, cats] = await Promise.all([fetchAll(), fetchCats()]);
      setRows(data);
      setCategories(cats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los ingredientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setUnit("");
    setUnitsPerBulk("1");
    setCost("");
    setCategoryId("none");
    setFormOpen(true);
  };

  const openEdit = (r: GlobalIngredientRow) => {
    setEditing(r);
    setName(r.name);
    setUnit(r.unit ?? "");
    setUnitsPerBulk(r.unitsPerBulk ?? "1");
    setCost(r.cost ?? "");
    setCategoryId(r.categoryId === null ? "none" : String(r.categoryId));
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const bulk = Number(unitsPerBulk);
    const bulkVal = Number.isNaN(bulk) || bulk <= 0 ? 1 : bulk;
    const costNum = Number(cost);
    const costVal = cost.trim() === "" || Number.isNaN(costNum) ? null : costNum;
    const catId = categoryId === "none" ? null : Number(categoryId);
    setSaving(true);
    try {
      if (editing) {
        await doUpdate({
          data: { id: editing.id, name: name.trim(), unit: unit.trim() || undefined, unitsPerBulk: bulkVal, cost: costVal, categoryId: catId },
        });
        toast.success("Ingrediente actualizado");
      } else {
        await doCreate({
          data: { name: name.trim(), unit: unit.trim() || undefined, unitsPerBulk: bulkVal, cost: costVal, categoryId: catId },
        });
        toast.success("Ingrediente creado");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await doDelete({ data: { id: toDelete.id } });
      toast.success("Ingrediente eliminado");
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<GlobalIngredientRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Nombre",
        sortable: true,
        sortAccessor: (r) => r.name.toLowerCase(),
        cell: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: "category",
        header: "Categoría",
        sortable: true,
        sortAccessor: (r) => (r.categoryName ?? "").toLowerCase(),
        cell: (r) => <span className="text-muted-foreground">{r.categoryName ?? "—"}</span>,
      },
      {
        key: "unit",
        header: "Unidad",
        sortable: true,
        sortAccessor: (r) => r.unit ?? "",
        cell: (r) => <span className="text-muted-foreground">{r.unit ?? "—"}</span>,
      },
      {
        key: "bulk",
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
        key: "cost",
        header: "Costo",
        sortable: true,
        sortAccessor: (r) => (r.cost === null ? -1 : Number(r.cost)),
        cell: (r) => (
          <span className="text-muted-foreground">{r.cost === null ? "—" : `$${r.cost}`}</span>
        ),
      },
      {
        key: "actions",
        header: "Acción",
        align: "right",
        cell: (r) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setToDelete(r)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ingredientes globales</h2>
          <p className="text-sm text-muted-foreground">Disponibles para todas las empresas.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo ingrediente global
        </Button>
      </div>

      <DataTable<GlobalIngredientRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={PANEL}
        loading={loading}
        emptyMessage="No hay ingredientes globales."
        emptyIcon={<Carrot className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.name]}
        searchPlaceholder="Buscar ingrediente..."
        toolbar={
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              <SelectItem value="sin">Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        filter={(r) =>
          categoryFilter === "todas"
            ? true
            : categoryFilter === "sin"
              ? r.categoryId === null
              : r.categoryId === Number(categoryFilter)
        }
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={12}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ingrediente global" : "Nuevo ingrediente global"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gi-name">Nombre</Label>
              <Input id="gi-name" value={name} maxLength={120} autoFocus onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-category">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="gi-category" className="h-11">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-unit">Unidad</Label>
              <Select value={unit || "none"} onValueChange={(v) => setUnit(v === "none" ? "" : v)}>
                <SelectTrigger id="gi-unit" className="h-11">
                  <SelectValue placeholder="Sin unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin unidad</SelectItem>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-bulk">UxB</Label>
              <Input
                id="gi-bulk"
                type="number"
                step="0.01"
                min="1"
                value={unitsPerBulk}
                onChange={(e) => setUnitsPerBulk(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Unidades por bulto. 1 = no viene en bulto.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-cost">Costo de compra</Label>
              <Input
                id="gi-cost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Opcional"
              />
              <p className="text-xs text-muted-foreground">
                Costo unitario de compra. Para costear recetas. No es precio de venta.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ingrediente global</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{toDelete?.name}</span>? Afecta a
            todas las empresas. Si está en uso (productos o movimientos), no se podrá borrar.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" className="gap-2" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
