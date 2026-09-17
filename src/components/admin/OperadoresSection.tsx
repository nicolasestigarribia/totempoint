import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  listOperators,
  createOperator,
  updateOperator,
  setOperatorActive,
  type OperatorRow,
} from "@/lib/api/users.functions";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import { checkPassword, checkEmail, PASSWORD_HINT } from "@/lib/auth/password-policy";
import {
  PANEL_SECTIONS,
  SECTION_LABEL,
  impliedBy,
  effectiveLevel,
  type PanelSection,
  type PermissionLevel,
  type PermissionMap,
} from "@/lib/auth/permissions";

type AssignableRole = "encargado" | "kitchen";

type PermMap = PermissionMap;

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superusuario",
  owner: "Dueño",
  encargado: "Encargado",
  kitchen: "Cocina",
};

/** El dueño y el superusuario no se editan desde acá. */
function isProtected(row: OperatorRow) {
  return row.roles.includes("owner") || row.roles.includes("superadmin");
}

export function OperadoresSection({ panelClass }: { panelClass: string }) {
  const fetchOperators = useServerFn(listOperators);
  const fetchLocations = useServerFn(listLocations);
  const create = useServerFn(createOperator);
  const update = useServerFn(updateOperator);
  const toggleActiveFn = useServerFn(setOperatorActive);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OperatorRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorRow | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>("encargado");
  const [assigned, setAssigned] = useState<number[]>([]);
  const [perms, setPerms] = useState<PermMap>({});
  const [saving, setSaving] = useState(false);

  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activos" | "inactivos">("todos");

  const reload = async () => {
    try {
      setRows(await fetchOperators());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los operadores");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [ops, locs] = await Promise.all([fetchOperators(), fetchLocations()]);
        if (!mounted) return;
        setRows(ops);
        setLocations(locs);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los operadores");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchOperators, fetchLocations]);

  const openCreate = () => {
    setEditing(null);
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("encargado");
    setAssigned([]);
    setPerms({});
    setDialogOpen(true);
  };

  const openEdit = (row: OperatorRow) => {
    setEditing(row);
    setEmail(row.email);
    setUsername(row.username ?? "");
    setPassword("");
    setRole(row.roles.includes("kitchen") ? "kitchen" : "encargado");
    setAssigned(row.locationIds);
    setPerms(row.permissions);
    setDialogOpen(true);
  };

  const toggleAssigned = (locationId: number, checked: boolean) => {
    setAssigned((prev) =>
      checked ? [...new Set([...prev, locationId])] : prev.filter((id) => id !== locationId),
    );
  };

  const setPerm = (section: PanelSection, value: "no" | PermissionLevel) => {
    setPerms((prev) => {
      const next = { ...prev };
      if (value === "no") delete next[section];
      else next[section] = value;
      // Lo que arrastra esta sección sube con ella (Productos abre Categorías).
      for (const target of impliedBy(section)) {
        const efectivo = effectiveLevel(next, target);
        if (efectivo) next[target] = efectivo;
        else delete next[target];
      }
      return next;
    });
  };

  const permissionsPayload = () =>
    (Object.entries(perms) as [PanelSection, PermissionLevel][]).map(([section, level]) => ({
      section,
      level,
    }));

  const handleSave = async () => {
    if (!email.trim() || !username.trim()) {
      toast.error("El email y el usuario son obligatorios");
      return;
    }
    const emailCheck = checkEmail(email);
    if (!emailCheck.ok) {
      toast.error(emailCheck.problema!);
      return;
    }
    if (!editing || password.length > 0) {
      const check = checkPassword(password);
      if (!check.ok) {
        toast.error(`Contraseña débil: ${check.problemas.join(", ").toLowerCase()}`);
        return;
      }
    }
    if (role === "encargado" && assigned.length === 0) {
      toast.error("Asigná al menos un negocio al encargado");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await update({
          data: {
            userId: editing.id,
            email: email.trim(),
            username: username.trim(),
            password: password.length > 0 ? password : null,
            role,
            locationIds: assigned,
            permissions: permissionsPayload(),
          },
        });
        toast.success("Operador actualizado");
      } else {
        await create({
          data: {
            email: email.trim(),
            username: username.trim(),
            password,
            role,
            locationIds: assigned,
            permissions: permissionsPayload(),
          },
        });
        toast.success("Operador creado");
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el operador");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: OperatorRow, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      await toggleActiveFn({ data: { userId: row.id, active: next } });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const locationNames = (ids: number[]) =>
    ids
      .map((id) => locations.find((l) => l.id === id)?.name)
      .filter((n): n is string => Boolean(n));

  const columns: Column<OperatorRow>[] = [
    {
      key: "username",
      header: "Usuario",
      sortable: true,
      sortAccessor: (r) => (r.username ?? r.email).toLowerCase(),
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.username ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{r.email}</span>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Rol",
      sortable: true,
      sortAccessor: (r) => r.roles.join(","),
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.roles.map((role) => ROLE_LABEL[role] ?? role).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "locations",
      header: "Negocios",
      cell: (r) => {
        if (r.roles.includes("owner")) {
          return <span className="text-muted-foreground">Todos</span>;
        }
        const names = locationNames(r.locationIds);
        return (
          <span className="text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>
        );
      },
    },
    {
      key: "permisos",
      header: "Permisos",
      cell: (r) => {
        if (r.roles.includes("owner") || r.roles.includes("superadmin")) {
          return <span className="text-muted-foreground">Todo</span>;
        }
        const entries = Object.entries(r.permissions) as [PanelSection, PermissionLevel][];
        if (entries.length === 0) return <span className="text-muted-foreground">Ninguno</span>;
        const editar = entries.filter(([, l]) => l === "editar").length;
        return (
          <span className="text-muted-foreground">
            {entries.length} {entries.length === 1 ? "sección" : "secciones"}
            {editar > 0 ? ` · ${editar} editable${editar === 1 ? "" : "s"}` : ""}
          </span>
        );
      },
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
            disabled={isProtected(r) || r.isSelf}
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
            disabled={isProtected(row)}
            onClick={() => openEdit(row)}
            aria-label="Editar operador"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Operadores</h3>
          <p className="text-sm text-muted-foreground">
            Encargados de tus negocios. Cada uno ve solamente los negocios que le asignes.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo operador
        </Button>
      </div>

      <DataTable<OperatorRow>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        panelClass={panelClass}
        loading={loading}
        emptyMessage="Todavía no diste de alta ningún operador."
        emptyIcon={<Users className="h-8 w-8 opacity-40" />}
        searchKeys={[(r) => r.username ?? "", (r) => r.email]}
        searchPlaceholder="Buscar operador..."
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
        initialSort={{ key: "username", dir: "asc" }}
        pageSize={10}
      />

      {/* Modal crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar operador" : "Nuevo operador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="op-email">Email</Label>
              <Input
                id="op-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="encargado@empresa.com"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-username">Usuario</Label>
              <Input
                id="op-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="encargado.centro"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-password">
                {editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              </Label>
              <Input
                id="op-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? "Dejar vacío para no cambiarla" : PASSWORD_HINT}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-role">Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
                <SelectTrigger id="op-role" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="encargado">Encargado</SelectItem>
                  <SelectItem value="kitchen">Cocina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Negocios asignados</Label>
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay negocios cargados todavía. Creá uno en la sección Negocios.
                </p>
              ) : (
                <div className="space-y-2 rounded-md border border-border p-3">
                  {locations.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`op-loc-${l.id}`}
                        checked={assigned.includes(l.id)}
                        onCheckedChange={(v) => toggleAssigned(l.id, v === true)}
                      />
                      <Label htmlFor={`op-loc-${l.id}`} className="cursor-pointer font-normal">
                        {l.name}
                        {!l.active && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Qué puede hacer en el panel</Label>
              <p className="text-xs text-muted-foreground">
                Sin acceso, la sección no le aparece. Los datos de la empresa, los negocios y los
                operadores los maneja solo el dueño.
              </p>
              <div className="space-y-2 rounded-md border border-border p-3">
                {PANEL_SECTIONS.map((section) => {
                  const efectivo = effectiveLevel(perms, section);
                  const arrastrado = efectivo !== undefined && perms[section] === undefined;
                  return (
                    <div key={section} className="flex items-center justify-between gap-3">
                      <span className="text-sm">
                        {SECTION_LABEL[section]}
                        {arrastrado && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            se abre con Productos
                          </span>
                        )}
                      </span>
                      <Select
                        value={efectivo ?? "no"}
                        onValueChange={(v) => setPerm(section, v as "no" | PermissionLevel)}
                      >
                        <SelectTrigger className="h-9 w-40 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">Sin acceso</SelectItem>
                          <SelectItem value="ver">Solo ver</SelectItem>
                          <SelectItem value="editar">Ver y editar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Quien puede cargar productos también puede crear categorías: sin eso no tendría
                dónde ponerlos.
              </p>
            </div>
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
    </div>
  );
}
