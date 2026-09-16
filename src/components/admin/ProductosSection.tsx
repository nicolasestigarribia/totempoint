import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Package, X, Search } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  setProductActive,
  type ProductRow,
} from "@/lib/api/products.functions";
import {
  listCategories,
  type CategoryRow,
} from "@/lib/api/categories.functions";
import {
  listIngredients,
  type IngredientRow,
} from "@/lib/api/ingredients.functions";

interface DraftIngredient {
  ingredientId: number;
  name: string;
  unit: string | null;
  quantity: string;
}

export function ProductosSection({ panelClass }: { panelClass: string }) {
  const list = useServerFn(listProducts);
  const create = useServerFn(createProduct);
  const update = useServerFn(updateProduct);
  const remove = useServerFn(deleteProduct);
  const toggleActiveFn = useServerFn(setProductActive);
  const loadCategories = useServerFn(listCategories);
  const loadIngredients = useServerFn(listIngredients);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [active, setActive] = useState(true);
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [estadoFilter, setEstadoFilter] = useState<
    "todos" | "activos" | "inactivos"
  >("todos");

  async function loadProductsOnly() {
    try {
      const data = await list();
      setRows(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar los productos",
      );
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [prods, cats, ings] = await Promise.all([
        list(),
        loadCategories(),
        loadIngredients(),
      ]);
      setRows(prods);
      setCategories(cats);
      setIngredients(ings);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar los datos",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const availableIngredients = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    return ingredients.filter(
      (i) =>
        !draftIngredients.some((d) => d.ingredientId === i.id) &&
        (q === "" || i.name.toLowerCase().includes(q)),
    );
  }, [ingredients, draftIngredients, ingredientSearch]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
    setPhotoUrl("");
    setActive(true);
    setDraftIngredients([]);
    setIngredientSearch("");
    setDialogOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setPrice(row.price);
    setCategoryId(row.categoryId === null ? "" : String(row.categoryId));
    setPhotoUrl(row.photoUrl ?? "");
    setActive(row.active);
    setDraftIngredients(
      row.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity ?? "",
      })),
    );
    setIngredientSearch("");
    setDialogOpen(true);
  }

  function addIngredient(id: number) {
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    setDraftIngredients((prev) => [
      ...prev,
      { ingredientId: ing.id, name: ing.name, unit: ing.unit, quantity: "" },
    ]);
  }

  function removeDraftIngredient(id: number) {
    setDraftIngredients((prev) => prev.filter((d) => d.ingredientId !== id));
  }

  function setDraftQuantity(id: number, value: string) {
    setDraftIngredients((prev) =>
      prev.map((d) => (d.ingredientId === id ? { ...d, quantity: value } : d)),
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre es requerido");
      return;
    }
    const priceValue = Number.parseFloat(price);
    if (Number.isNaN(priceValue)) {
      toast.error("El precio es requerido");
      return;
    }

    const ingredientsPayload = draftIngredients.map((d) => {
      const q = d.quantity.trim();
      const parsed = q === "" ? null : Number.parseFloat(q);
      return {
        ingredientId: d.ingredientId,
        quantity: parsed === null || Number.isNaN(parsed) ? null : parsed,
      };
    });

    const parsedCategory = categoryId === "" ? null : Number.parseInt(categoryId, 10);
    const trimmedPhoto = photoUrl.trim();
    const trimmedDesc = description.trim();

    setSaving(true);
    try {
      if (editing) {
        await update({
          data: {
            id: editing.id,
            name: trimmedName,
            description: trimmedDesc || undefined,
            price: priceValue,
            categoryId: parsedCategory,
            photoUrl: trimmedPhoto || undefined,
            active,
            sort: editing.sort,
            ingredients: ingredientsPayload,
          },
        });
        toast.success("Producto actualizado");
      } else {
        await create({
          data: {
            name: trimmedName,
            description: trimmedDesc || undefined,
            price: priceValue,
            categoryId: parsedCategory,
            photoUrl: trimmedPhoto || undefined,
            ingredients: ingredientsPayload,
          },
        });
        toast.success("Producto creado");
      }
      setDialogOpen(false);
      await loadProductsOnly();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el producto",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ProductRow) {
    if (!window.confirm(`¿Eliminar el producto "${row.name}"?`)) return;
    setDeletingId(row.id);
    try {
      await remove({ data: { id: row.id } });
      toast.success("Producto eliminado");
      await loadProductsOnly();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el producto",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(row: ProductRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      await toggleActiveFn({ data: { id: row.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  const columns: Column<ProductRow>[] = [
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
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.categoryName ??
            (r.categoryId !== null
              ? categoryNameById.get(r.categoryId) ?? "Sin categoría"
              : "Sin categoría")}
        </span>
      ),
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      sortAccessor: (r) => Number(r.price),
      cell: (r) => <span className="text-muted-foreground">${r.price}</span>,
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
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row)}
            disabled={deletingId === row.id}
            aria-label="Eliminar"
          >
            {deletingId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-red-400" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold">Productos</h3>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="No hay productos todavía."
        emptyIcon={<Package className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.name, (r) => r.description ?? ""]}
        searchPlaceholder="Buscar producto..."
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={10}
        filter={(r) => {
          const okCat =
            categoryFilter === "todas"
              ? true
              : categoryFilter === "sin"
                ? r.categoryId === null
                : r.categoryId === Number(categoryFilter);
          const okEstado =
            estadoFilter === "todos"
              ? true
              : estadoFilter === "activos"
                ? r.active
                : !r.active;
          return okCat && okEstado;
        }}
        toolbar={
          <>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value="sin">Sin categoría</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={estadoFilter}
              onValueChange={(v) =>
                setEstadoFilter(v as "todos" | "activos" | "inactivos")
              }
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
          </>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Datos generales */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Datos generales
              </h4>
              <div className="space-y-2">
                <Label htmlFor="product-name">Nombre</Label>
                <Input
                  id="product-name"
                  value={name}
                  maxLength={120}
                  placeholder="Ej: Hamburguesa clásica"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-description">Descripción</Label>
                <textarea
                  id="product-description"
                  value={description}
                  rows={3}
                  placeholder="Descripción del producto"
                  className="w-full rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Precio</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  value={price}
                  placeholder="0.00"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Categoría</Label>
                <Select
                  value={categoryId || "none"}
                  onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="product-category" className="h-11">
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
              <ImageUploadField
                id="product-photo"
                label="Foto del producto"
                value={photoUrl}
                onChange={setPhotoUrl}
              />
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    id="product-active"
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-primary"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <Label htmlFor="product-active" className="cursor-pointer">
                    Activo
                  </Label>
                </div>
              )}
            </div>

            {/* Ingredientes: buscador + seleccionados */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ingredientes
              </h4>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ingredientSearch}
                  placeholder="Buscar ingrediente..."
                  className="h-11 pl-9"
                  onChange={(e) => setIngredientSearch(e.target.value)}
                />
              </div>
              <div className="max-h-40 divide-y divide-white/5 overflow-auto rounded-md border border-white/10">
                {availableIngredients.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {ingredients.length === 0
                      ? "No hay ingredientes cargados"
                      : "Sin resultados"}
                  </p>
                ) : (
                  availableIngredients.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => addIngredient(i.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5"
                    >
                      <span>
                        {i.name}
                        {i.unit ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({i.unit})
                          </span>
                        ) : null}
                      </span>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Seleccionados ({draftIngredients.length})
                </p>
                {draftIngredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no agregaste ingredientes.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {draftIngredients.map((d) => (
                      <div
                        key={d.ingredientId}
                        className="flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2"
                      >
                        <span className="flex-1 text-sm font-medium">
                          {d.name}
                          {d.unit ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({d.unit})
                            </span>
                          ) : null}
                        </span>
                        {d.unit ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={d.quantity}
                            placeholder="Cant."
                            className="h-9 w-24"
                            onChange={(e) =>
                              setDraftQuantity(d.ingredientId, e.target.value)
                            }
                          />
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar ingrediente"
                          onClick={() => removeDraftIngredient(d.ingredientId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
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
