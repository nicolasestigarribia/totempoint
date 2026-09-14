import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  listGlobalActionCodes,
  createGlobalActionCode,
  updateGlobalActionCode,
  deleteGlobalActionCode,
  type GlobalActionCodeRow,
} from "@/lib/api/actioncodes.functions";

type Kind = "stock" | "caja";
type Dir = "ingreso" | "egreso";

const PANEL = "rounded-3xl border border-border bg-card shadow-lg";

export function GlobalActionCodesSection() {
  const fetchAll = useServerFn(listGlobalActionCodes);
  const doCreate = useServerFn(createGlobalActionCode);
  const doUpdate = useServerFn(updateGlobalActionCode);
  const doDelete = useServerFn(deleteGlobalActionCode);

  const [rows, setRows] = useState<GlobalActionCodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalActionCodeRow | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<Kind>("stock");
  const [direction, setDirection] = useState<Dir>("ingreso");
  const [auto, setAuto] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<GlobalActionCodeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setRows(await fetchAll());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los códigos globales");
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
    setAuto(false);
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (r: GlobalActionCodeRow) => {
    setEditing(r);
    setCode(r.code);
    setLabel(r.label);
    setType(r.type);
    setDirection(r.direction);
    setAuto(r.auto);
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
        await doUpdate({ data: { id: editing.id, label: label.trim(), type, direction, auto, active } });
        toast.success("Código actualizado");
      } else {
        await doCreate({ data: { code: code.trim(), label: label.trim(), type, direction, auto } });
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

  const columns: Column<GlobalActionCodeRow>[] = useMemo(
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
        key: "auto",
        header: "Auto",
        sortable: true,
        sortAccessor: (r) => (r.auto ? 1 : 0),
        cell: (r) =>
          r.auto ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              Sistema
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Manual</span>
          ),
      },
      {
        key: "active",
        header: "Estado",
        sortable: true,
        sortAccessor: (r) => (r.active ? 1 : 0),
        cell: (r) => (
          <span className={`text-xs ${r.active ? "text-green-400" : "text-muted-foreground"}`}>
            {r.active ? "Activo" : "Inactivo"}
          </span>
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
          <h2 className="text-2xl font-bold tracking-tight">Códigos de acción globales</h2>
          <p className="text-sm text-muted-foreground">Compartidos por todas las empresas.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo código global
        </Button>
      </div>

      <DataTable<GlobalActionCodeRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={PANEL}
        loading={loading}
        emptyMessage="No hay códigos globales."
        emptyIcon={<Tags className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.code, (r) => r.label]}
        searchPlaceholder="Buscar código..."
        initialSort={{ key: "code", dir: "asc" }}
        pageSize={12}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar código global" : "Nuevo código global"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gac-code">Código</Label>
              <Input
                id="gac-code"
                value={code}
                disabled={!!editing}
                maxLength={40}
                placeholder="Ej: VENTA"
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {editing ? "El código no se puede cambiar." : "Se normaliza a MAYÚSCULAS con guiones bajos."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gac-label">Nombre visible</Label>
              <Input
                id="gac-label"
                value={label}
                maxLength={120}
                placeholder="Ej: Venta"
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
            <div className="flex items-center gap-2">
              <Switch checked={auto} onCheckedChange={setAuto} />
              <div>
                <Label className="cursor-pointer">Automático (sistema)</Label>
                <p className="text-xs text-muted-foreground">
                  Si está activo, no se puede cargar a mano (ej: ventas).
                </p>
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
            <DialogTitle>Eliminar código global</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{toDelete?.label}</span> (
            <code>{toDelete?.code}</code>)? Afecta a todas las empresas. Si tiene movimientos, no se
            podrá borrar.
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
