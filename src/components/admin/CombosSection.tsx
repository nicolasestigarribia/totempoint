import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Boxes, X, Search, Eye } from "lucide-react";
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
  listCombos,
  createCombo,
  updateCombo,
  deleteCombo,
  setComboActive,
  type ComboRow,
} from "@/lib/api/combos.functions";
import { listProducts, type ProductRow } from "@/lib/api/products.functions";

interface DraftProduct {
  productId: number;
  name: string;
  price: string;
  quantity: string;
}

export function CombosSection({ panelClass }: { panelClass: string }) {
  const list = useServerFn(listCombos);
  const create = useServerFn(createCombo);
  const update = useServerFn(updateCombo);
  const remove = useServerFn(deleteCombo);
  const toggleActiveFn = useServerFn(setComboActive);
  const loadProducts = useServerFn(listProducts);

  const [rows, setRows] = useState<ComboRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ComboRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [active, setActive] = useState(true);
  const [draftProducts, setDraftProducts] = useState<DraftProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewTarget, setViewTarget] = useState<ComboRow | null>(null);

  const [estadoFilter, setEstadoFilter] = useState<
    "todos" | "activos" | "inactivos"
  >("todos");

  async function loadCombosOnly() {
    try {
      const data = await list();
      setRows(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar los combos",
      );
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cmb, prods] = await Promise.all([list(), loadProducts()]);
      setRows(cmb);
      setProducts(prods);
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

  const availableProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        !draftProducts.some((d) => d.productId === p.id) &&
        (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [products, draftProducts, productSearch]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setPhotoUrl("");
    setActive(true);
    setDraftProducts([]);
    setProductSearch("");
    setDialogOpen(true);
  }

  function openEdit(row: ComboRow) {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setPrice(row.price);
    setPhotoUrl(row.photoUrl ?? "");
    setActive(row.active);
    setDraftProducts(
      row.products.map((p) => ({
        productId: p.productId,
        name: p.name,
        price: p.price,
        quantity: String(p.quantity),
      })),
    );
    setProductSearch("");
    setDialogOpen(true);
  }

  function addProduct(id: number) {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    setDraftProducts((prev) => [
      ...prev,
      { productId: prod.id, name: prod.name, price: prod.price, quantity: "1" },
    ]);
  }

  function removeDraftProduct(id: number) {
    setDraftProducts((prev) => prev.filter((d) => d.productId !== id));
  }

  function setDraftQuantity(id: number, value: string) {
    setDraftProducts((prev) =>
      prev.map((d) => (d.productId === id ? { ...d, quantity: value } : d)),
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

    const productsPayload = draftProducts.map((d) => {
      const parsed = Number.parseInt(d.quantity, 10);
      return {
        productId: d.productId,
        quantity: Number.isNaN(parsed) || parsed < 1 ? 1 : parsed,
      };
    });

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
            photoUrl: trimmedPhoto || undefined,
            active,
            sort: editing.sort,
            products: productsPayload,
          },
        });
        toast.success("Combo actualizado");
      } else {
        await create({
          data: {
            name: trimmedName,
            description: trimmedDesc || undefined,
            price: priceValue,
            photoUrl: trimmedPhoto || undefined,
            products: productsPayload,
          },
        });
        toast.success("Combo creado");
      }
      setDialogOpen(false);
      await loadCombosOnly();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el combo",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ComboRow) {
    if (!window.confirm(`¿Eliminar el combo "${row.name}"?`)) return;
    setDeletingId(row.id);
    try {
      await remove({ data: { id: row.id } });
      toast.success("Combo eliminado");
      await loadCombosOnly();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el combo",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(row: ComboRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      await toggleActiveFn({ data: { id: row.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  const columns: Column<ComboRow>[] = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      sortAccessor: (r) => Number(r.price),
      cell: (r) => <span className="text-muted-foreground">${r.price}</span>,
    },
    {
      key: "products",
      header: "Productos",
      cell: (r) => <span>{r.products.length}</span>,
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
            onClick={() => setViewTarget(row)}
            aria-label="Ver productos"
            title="Ver productos"
          >
            <Eye className="h-4 w-4" />
          </Button>
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
        <h3 className="text-lg font-bold">Combos</h3>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo combo
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="No hay combos todavía."
        emptyIcon={<Boxes className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.name, (r) => r.description ?? ""]}
        searchPlaceholder="Buscar combo..."
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={10}
        filter={(r) =>
          estadoFilter === "todos"
            ? true
            : estadoFilter === "activos"
              ? r.active
              : !r.active
        }
        toolbar={
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
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar combo" : "Nuevo combo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Datos generales */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Datos generales
              </h4>
              <div className="space-y-2">
                <Label htmlFor="combo-name">Nombre</Label>
                <Input
                  id="combo-name"
                  value={name}
                  maxLength={120}
                  placeholder="Ej: Combo familiar"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="combo-description">Descripción</Label>
                <textarea
                  id="combo-description"
                  value={description}
                  rows={3}
                  placeholder="Descripción del combo"
                  className="w-full rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="combo-price">Precio</Label>
                <Input
                  id="combo-price"
                  type="number"
                  step="0.01"
                  value={price}
                  placeholder="0.00"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <ImageUploadField
                id="combo-photo"
                label="Foto del combo"
                value={photoUrl}
                onChange={setPhotoUrl}
              />
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    id="combo-active"
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-primary"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <Label htmlFor="combo-active" className="cursor-pointer">
                    Activo
                  </Label>
                </div>
              )}
            </div>

            {/* Productos: buscador + seleccionados */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Productos
              </h4>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  placeholder="Buscar producto..."
                  className="h-11 pl-9"
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="max-h-40 divide-y divide-white/5 overflow-auto rounded-md border border-white/10">
                {availableProducts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {products.length === 0
                      ? "No hay productos cargados"
                      : "Sin resultados"}
                  </p>
                ) : (
                  availableProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5"
                    >
                      <span>
                        {p.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          (${p.price})
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Seleccionados ({draftProducts.length})
                </p>
                {draftProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no agregaste productos.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {draftProducts.map((d) => (
                      <div
                        key={d.productId}
                        className="flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2"
                      >
                        <span className="flex-1 text-sm font-medium">
                          {d.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            (${d.price})
                          </span>
                        </span>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={d.quantity}
                          placeholder="Cant."
                          className="h-9 w-24"
                          onChange={(e) =>
                            setDraftQuantity(d.productId, e.target.value)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar producto"
                          onClick={() => removeDraftProduct(d.productId)}
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

      {/* Ver productos del combo */}
      <Dialog open={viewTarget !== null} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Productos de {viewTarget?.name}</DialogTitle>
          </DialogHeader>
          {viewTarget && viewTarget.products.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Este combo no tiene productos cargados.
            </p>
          ) : (
            <div className="space-y-2">
              {viewTarget?.products.map((p) => (
                <div
                  key={p.productId}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    <span className="text-muted-foreground">{p.quantity}×</span> {p.name}
                  </span>
                  <span className="text-muted-foreground">${p.price}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 pt-2 text-sm">
                <span className="text-muted-foreground">Precio del combo</span>
                <span className="font-semibold">${viewTarget?.price}</span>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
