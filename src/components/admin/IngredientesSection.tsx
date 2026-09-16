import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Loader2, Carrot, FolderCog, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, type Column } from "@/components/admin/DataTable";
import {
  listIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  type IngredientRow,
} from "@/lib/api/ingredients.functions";
import {
  listIngredientCategories,
  createIngredientCategory,
  updateIngredientCategory,
  deleteIngredientCategory,
  type IngredientCategoryRow,
} from "@/lib/api/ingredientcategories.functions";

const UNITS = ["Grs", "Kg", "Mg", "Ml", "Lts", "Cc", "Cm", "Mm", "Mts", "Unidad"] as const;

export function IngredientesSection({ panelClass }: { panelClass: string }) {
  const fetchIngredients = useServerFn(listIngredients);
  const doCreate = useServerFn(createIngredient);
  const doUpdate = useServerFn(updateIngredient);
  const doDelete = useServerFn(deleteIngredient);
  const fetchCategories = useServerFn(listIngredientCategories);
  const catCreate = useServerFn(createIngredientCategory);
  const catUpdate = useServerFn(updateIngredientCategory);
  const catDelete = useServerFn(deleteIngredientCategory);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [categories, setCategories] = useState<IngredientCategoryRow[]>([]);

  // Modal crear/editar
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [unitsPerBulk, setUnitsPerBulk] = useState("1");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  // Modal borrar
  const [deleteTarget, setDeleteTarget] = useState<IngredientRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  // Gestor de categorías
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const load = async () => {
    try {
      const [data, cats] = await Promise.all([fetchIngredients(), fetchCategories()]);
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

  const openEdit = (row: IngredientRow) => {
    setEditing(row);
    setName(row.name);
    setUnit(row.unit ?? "");
    setUnitsPerBulk(row.unitsPerBulk ?? "1");
    setCost(row.cost ?? "");
    setCategoryId(row.categoryId === null ? "none" : String(row.categoryId));
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const bulk = Number(unitsPerBulk);
      const bulkVal = Number.isNaN(bulk) || bulk <= 0 ? 1 : bulk;
      const costNum = Number(cost);
      const costVal = cost.trim() === "" || Number.isNaN(costNum) ? null : costNum;
      const catId = categoryId === "none" ? null : Number(categoryId);
      if (editing) {
        await doUpdate({
          data: {
            id: editing.id,
            name: name.trim(),
            unit: unit.trim() || undefined,
            unitsPerBulk: bulkVal,
            cost: costVal,
            categoryId: catId,
          },
        });
        toast.success("Ingrediente actualizado");
      } else {
        await doCreate({
          data: {
            name: name.trim(),
            unit: unit.trim() || undefined,
            unitsPerBulk: bulkVal,
            cost: costVal,
            categoryId: catId,
          },
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
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await doDelete({ data: { id: deleteTarget.id } });
      toast.success("Ingrediente eliminado");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setCatBusy(true);
    try {
      await catCreate({ data: { name: newCatName.trim() } });
      setNewCatName("");
      const cats = await fetchCategories();
      setCategories(cats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la categoría");
    } finally {
      setCatBusy(false);
    }
  };

  const handleRenameCategory = async (cat: IngredientCategoryRow, name: string) => {
    if (!name.trim() || name.trim() === cat.name) return;
    try {
      await catUpdate({ data: { id: cat.id, name: name.trim(), active: cat.active } });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name: name.trim() } : c)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo renombrar");
    }
  };

  const handleDeleteCategory = async (cat: IngredientCategoryRow) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${cat.name}"? Los ingredientes quedan sin categoría.`,
      )
    )
      return;
    try {
      await catDelete({ data: { id: cat.id } });
      const [cats, ings] = await Promise.all([fetchCategories(), fetchIngredients()]);
      setCategories(cats);
      setRows(ings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  const columns: Column<IngredientRow>[] = [
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
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Ingredientes</h3>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCatManagerOpen(true)}>
            <FolderCog className="h-4 w-4" />
            Categorías
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo ingrediente
          </Button>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="Todavía no hay ingredientes."
        emptyIcon={<Carrot className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.name]}
        searchPlaceholder="Buscar ingrediente..."
        filter={(r) => {
          const okCat =
            categoryFilter === "todas"
              ? true
              : categoryFilter === "sin"
                ? r.categoryId === null
                : r.categoryId === Number(categoryFilter);
          return okCat;
        }}
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={10}
        toolbar={
          <>
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
          </>
        }
      />

      {/* Modal crear / editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ingrediente" : "Nuevo ingrediente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ingredient-name">Nombre</Label>
              <Input
                id="ingredient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingredient-unit">Unidad</Label>
              <Select value={unit || "none"} onValueChange={(v) => setUnit(v === "none" ? "" : v)}>
                <SelectTrigger id="ingredient-unit" className="h-11">
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
              <Label htmlFor="ingredient-category">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="ingredient-category" className="h-11">
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
              <Label htmlFor="ingredient-bulk">UxB</Label>
              <Input
                id="ingredient-bulk"
                type="number"
                step="0.01"
                min="1"
                value={unitsPerBulk}
                onChange={(e) => setUnitsPerBulk(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Cuántas unidades trae un bulto/caja. 1 = no viene en bulto (ej: caja de coca = 6).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingredient-cost">Costo de compra</Label>
              <Input
                id="ingredient-cost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Opcional"
              />
              <p className="text-xs text-muted-foreground">
                Costo unitario de compra. Sirve para costear recetas. No es precio de venta.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmación borrar */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ingrediente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar{" "}
            <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Esta acción
            no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gestor de categorías de ingredientes */}
      <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorías de ingredientes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCatName}
                maxLength={80}
                placeholder="Nueva categoría (ej: Lácteos)"
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button
                className="gap-2"
                onClick={handleAddCategory}
                disabled={catBusy || !newCatName.trim()}
              >
                {catBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Agregar
              </Button>
            </div>
            <div className="max-h-72 space-y-1 overflow-auto">
              {categories.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No hay categorías.</p>
              ) : (
                categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <Input
                      defaultValue={c.name}
                      maxLength={80}
                      className="h-8 flex-1"
                      onBlur={(e) => handleRenameCategory(c, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCategory(c)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">Renombrá tocando el nombre.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
