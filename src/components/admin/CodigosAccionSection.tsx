import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useReadOnly } from "@/components/admin/readonly";
import {
  listActionCodesAll,
  createActionCode,
  updateActionCode,
  setActionCodeActive,
  deleteActionCode,
  type ActionCodeRow,
} from "@/lib/api/actioncodes.functions";

type Kind = "stock" | "caja";
type Dir = "ingreso" | "egreso";

export function CodigosAccionSection({ panelClass }: { panelClass: string }) {
  const readOnly = useReadOnly();
  const fetchAll = useServerFn(listActionCodesAll);
  const doCreate = useServerFn(createActionCode);
  const doUpdate = useServerFn(updateActionCode);
  const doToggle = useServerFn(setActionCodeActive);
  const doDelete = useServerFn(deleteActionCode);

  const [rows, setRows] = useState<ActionCodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<"todos" | "stock" | "caja">("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ActionCodeRow | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<Kind>("stock");
  const [direction, setDirection] = useState<Dir>("ingreso");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<ActionCodeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setRows(await fetchAll());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los códigos");
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
    setCode("");
    setLabel("");
    setType("stock");
    setDirection("ingreso");
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (r: ActionCodeRow) => {
    setEditing(r);
    setCode(r.code);
    setLabel(r.label);
    setType(r.type);
    setDirection(r.direction);
    setActive(r.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!editing && !code.trim()) {
      toast.error("El código es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await doUpdate({ data: { id: editing.id, label: label.trim(), type, direction, active } });
        toast.success("Código actualizado");
      } else {
        await doCreate({ data: { code: code.trim(), label: label.trim(), type, direction } });
        toast.success("Código creado");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: ActionCodeRow, next: boolean) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    try {
      await doToggle({ data: { id: r.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !next } : x)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await doDelete({ data: { id: toDelete.id } });
      toast.success("Código eliminado");
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<ActionCodeRow>[] = useMemo(
    () => [
      {
        key: "code",
        header: "Código",
        sortable: true,
        sortAccessor: (r) => r.code,
        cell: (r) => <code className="text-xs text-muted-foreground">{r.code}</code>,
      },
      {
        key: "label",
        header: "Nombre",
        sortable: true,
        sortAccessor: (r) => r.label.toLowerCase(),
        cell: (r) => <span className="font-medium">{r.label}</span>,
      },
      {
        key: "type",
        header: "Tipo",
        sortable: true,
        sortAccessor: (r) => r.type,
        cell: (r) => (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              r.type === "stock" ? "bg-sky-500/15 text-sky-400" : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {r.type === "stock" ? "Stock" : "Caja"}
          </span>
        ),
      },
      {
        key: "direction",
        header: "Signo",
        sortable: true,
        sortAccessor: (r) => r.direction,
        cell: (r) => (
          <span className={r.direction === "ingreso" ? "text-green-400" : "text-amber-400"}>
            {r.direction === "ingreso" ? "Ingreso (+)" : "Egreso (−)"}
          </span>
        ),
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold">Códigos de acción</h3>
        {!readOnly && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo código
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="h-10 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Stock y Caja</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="caja">Caja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable<ActionCodeRow>
        rows={rows}
        columns={readOnly ? columns.filter((c) => c.key !== "actions") : columns}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="No hay códigos de acción."
        emptyIcon={<Tags className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.code, (r) => r.label]}
        searchPlaceholder="Buscar código..."
        filter={(r) => typeFilter === "todos" || r.type === typeFilter}
        initialSort={{ key: "code", dir: "asc" }}
        pageSize={12}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar código" : "Nuevo código de acción"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ac-code">Código</Label>
              <Input
                id="ac-code"
                value={code}
                disabled={!!editing}
                maxLength={40}
                placeholder="Ej: ING_COMPRA"
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "El código no se puede cambiar."
                  : "Se normaliza a MAYÚSCULAS con guiones bajos."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-label">Nombre visible</Label>
              <Input
                id="ac-label"
                value={label}
                maxLength={120}
                placeholder="Ej: Compra"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as Kind)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Signo</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as Dir)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso (+)</SelectItem>
                    <SelectItem value="egreso">Egreso (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label className="cursor-pointer">Activo</Label>
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

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar código</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{toDelete?.label}</span> (
            <code>{toDelete?.code}</code>)? Si ya tiene movimientos, no se podrá borrar
            (desactivalo).
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
