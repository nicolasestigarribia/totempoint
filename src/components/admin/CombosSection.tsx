import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Boxes, X, Search, Eye } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useReadOnly } from "@/components/admin/readonly";
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
import { listCategories, type CategoryRow } from "@/lib/api/categories.functions";
import { mensajeDeError } from "@/lib/error-message";

/** Lo que elige el cliente, mientras se edita: la cantidad como texto del input. */
interface DraftGrupo {
  nombre: string;
  cantidad: string;
  categoriaIds: number[];
}

interface DraftProduct {
  productId: number;
  name: string;
  price: string;
  quantity: string;
}

export function CombosSection({ panelClass }: { panelClass: string }) {
  const readOnly = useReadOnly();
  const list = useServerFn(listCombos);
  const create = useServerFn(createCombo);
  const update = useServerFn(updateCombo);
  const remove = useServerFn(deleteCombo);
  const toggleActiveFn = useServerFn(setComboActive);
  const loadProducts = useServerFn(listProducts);
  const loadCategories = useServerFn(listCategories);
  const [categorias, setCategorias] = useState<CategoryRow[]>([]);
  const [draftGrupos, setDraftGrupos] = useState<DraftGrupo[]>([]);

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

  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activos" | "inactivos">("todos");

  async function loadCombosOnly() {
    try {
      const data = await list();
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los combos");
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cmb, prods, cats] = await Promise.all([list(), loadProducts(), loadCategories()]);
      setRows(cmb);
      setProducts(prods);
      setCategorias(cats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los datos");
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
    setDraftGrupos([]);
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
    setDraftGrupos(row.grupos.map((g) => ({ ...g, cantidad: String(g.cantidad) })));
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
    if (priceValue < 0) {
      toast.error("El precio no puede ser negativo");
      return;
    }

    const productsPayload = draftProducts.map((d) => {
      const parsed = Number.parseInt(d.quantity, 10);
      return {
        productId: d.productId,
        quantity: Number.isNaN(parsed) || parsed < 1 ? 1 : parsed,
      };
    });

    const gruposPayload = draftGrupos.map((g) => ({
      nombre: g.nombre.trim(),
      cantidad: Number.parseInt(g.cantidad, 10) || 0,
      categoriaIds: g.categoriaIds,
    }));
    const grupoMal = gruposPayload.find(
      (g) => !g.nombre || g.cantidad < 1 || g.categoriaIds.length === 0,
    );
    if (grupoMal) {
      toast.error("En lo que elige el cliente completá nombre, cantidad y al menos una categoría");
      return;
    }
    if (productsPayload.length === 0 && gruposPayload.length === 0) {
      toast.error("El combo tiene que traer algo: productos fijos o algo para elegir");
      return;
    }

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
            grupos: gruposPayload,
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
            grupos: gruposPayload,
          },
        });
        toast.success("Combo creado");
      }
      setDialogOpen(false);
      await loadCombosOnly();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar el combo"));
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
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el combo");
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
            disabled={readOnly}
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
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Editar">
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
        {!readOnly && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo combo
          </Button>
        )}
      </div>

      <DataTable
        rows={rows}
        columns={readOnly ? columns.filter((c) => c.key !== "actions") : columns}
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
          estadoFilter === "todos" ? true : estadoFilter === "activos" ? r.active : !r.active
        }
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
                  min={0}
                  step="0.01"
                  inputMode="decimal"
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
            {/* Lo que elige el cliente: "18 empanadas clásicas, los gustos que
                quieras". Se suma a los productos fijos de abajo. */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  A elección del cliente
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ej: 18 de Empanadas clásicas. El cliente elige los gustos de esas categorías al
                  pedirlo, y la comanda los muestra.
                </p>
              </div>
              {draftGrupos.map((g, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-white/10 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={g.nombre}
                      placeholder="Qué elige (ej: Empanadas clásicas)"
                      className="h-10 flex-1"
                      onChange={(e) =>
                        setDraftGrupos((gs) =>
                          gs.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      value={g.cantidad}
                      aria-label="Cuántos"
                      placeholder="Cant."
                      className="h-10 w-20"
                      onChange={(e) =>
                        setDraftGrupos((gs) =>
                          gs.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Quitar"
                      onClick={() => setDraftGrupos((gs) => gs.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categorias.map((c) => {
                      const marcada = g.categoriaIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setDraftGrupos((gs) =>
                              gs.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      categoriaIds: marcada
                                        ? x.categoriaIds.filter((id) => id !== c.id)
                                        : [...x.categoriaIds, c.id],
                                    }
                                  : x,
                              ),
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                            marcada
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-white/15 text-muted-foreground"
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start gap-1.5"
                onClick={() =>
                  setDraftGrupos((gs) => [...gs, { nombre: "", cantidad: "", categoriaIds: [] }])
                }
              >
                <Plus className="h-4 w-4" /> Agregar algo a elección
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Productos fijos
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
                    {products.length === 0 ? "No hay productos cargados" : "Sin resultados"}
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
                        <span className="ml-1 text-xs text-muted-foreground">(${p.price})</span>
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
                  <p className="text-xs text-muted-foreground">Todavía no agregaste productos.</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {draftProducts.map((d) => (
                      <div
                        key={d.productId}
                        className="flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2"
                      >
                        <span className="flex-1 text-sm font-medium">
                          {d.name}
                          <span className="ml-1 text-xs text-muted-foreground">(${d.price})</span>
                        </span>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={d.quantity}
                          placeholder="Cant."
                          className="h-9 w-24"
                          onChange={(e) => setDraftQuantity(d.productId, e.target.value)}
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
