import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { me, logout } from "@/lib/api/auth.functions";
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
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  KeyRound,
  Building2,
  Receipt,
  PanelLeft,
  PanelLeftClose,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createBusiness,
  listBusinesses,
  setBusinessActive,
  updateBusinessAdmin,
  enterBusiness,
  type BusinessRow,
} from "@/lib/api/platform.functions";
import { FacturacionSection } from "@/components/admin/FacturacionSection";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Superadmin — Totempoint" },
      {
        name: "description",
        content: "Panel del administrador general: empresas, altas y estado de cada cuenta.",
      },
      { property: "og:title", content: "Superadmin — Totempoint" },
      {
        property: "og:description",
        content: "Panel del administrador general de la plataforma Totempoint.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperadminPage,
});

// El panel de plataforma administra empresas y mira cuánto factura cada una:
// el catálogo (ingredientes, categorías, códigos de acción) es de cada empresa.
type SectionId = "negocios" | "facturacion";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; desc: string }[] = [
  {
    id: "negocios",
    label: "Empresas",
    icon: Building2,
    desc: "Marcas dadas de alta en la plataforma",
  },
  {
    id: "facturacion",
    label: "Facturación",
    icon: Receipt,
    desc: "Cuánto factura cada empresa",
  },
];

function SuperadminPage() {
  const navigate = useNavigate();
  const fetchBusinesses = useServerFn(listBusinesses);
  const create = useServerFn(createBusiness);
  const toggleActive = useServerFn(setBusinessActive);
  const updateAdmin = useServerFn(updateBusinessAdmin);
  const doEnterBusiness = useServerFn(enterBusiness);
  const doMe = useServerFn(me);
  const doLogout = useServerFn(logout);

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("negocios");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [email, setEmail] = useState("");

  const [editRow, setEditRow] = useState<BusinessRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const user = await doMe();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setEmail(user.email);
      try {
        const data = await fetchBusinesses();
        if (mounted) setRows(data);
      } catch {
        toast.error("No tenés permisos de superadmin");
        navigate({ to: "/admin", replace: true });
        return;
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [navigate, fetchBusinesses, doMe]);

  const reload = async () => {
    try {
      setRows(await fetchBusinesses());
    } catch {
      /* noop */
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await create({ data: { name, adminEmail, adminUsername, adminPassword } });
      toast.success("Empresa creada");
      setName("");
      setAdminEmail("");
      setAdminUsername("");
      setAdminPassword("");
      setOpen(false);
      await reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la empresa");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: BusinessRow) => {
    setEditRow(row);
    setEditEmail(row.admin_email ?? "");
    setEditUsername(row.admin_username ?? "");
    setEditPassword("");
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow?.admin_user_id) return;
    setEditing(true);
    try {
      await updateAdmin({
        data: {
          userId: editRow.admin_user_id,
          email: editEmail,
          username: editUsername,
          password: editPassword || null,
        },
      });
      toast.success("Credenciales actualizadas");
      setEditRow(null);
      await reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setEditing(false);
    }
  };

  // Entrar al panel de una empresa: el superadmin ve y opera todo como el dueño.
  const handleEnter = async (row: BusinessRow) => {
    try {
      await doEnterBusiness({ data: { companyId: row.id } });
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entrar a la empresa");
    }
  };

  const handleToggle = async (row: BusinessRow) => {
    try {
      await toggleActive({ data: { id: row.id, active: !row.active } });
      await reload();
    } catch {
      toast.error("No se pudo cambiar el estado");
    }
  };

  const handleLogout = async () => {
    await doLogout();
    navigate({ to: "/login", replace: true });
  };

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    const onResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="relative min-h-screen bg-background lg:flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/40 backdrop-blur transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Plataforma</p>
            <p className="text-sm font-bold">Superadmin</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSection(s.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                section === s.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <s.icon className={`h-5 w-5 ${section === s.id ? "text-primary" : ""}`} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <div className="flex items-center gap-4 border-b border-border px-6 py-5 md:px-8">
          {!sidebarOpen && (
            <button
              type="button"
              aria-label="Abrir menú"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{current.label}</h1>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {section === "facturacion" ? (
            <FacturacionSection />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">Sesión: {email}</p>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Crear empresa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nueva empresa</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="biz-name">Nombre de la empresa</Label>
                        <Input
                          id="biz-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          minLength={2}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-email">Email del administrador</Label>
                        <Input
                          id="biz-email"
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-username">Usuario</Label>
                        <Input
                          id="biz-username"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          required
                          minLength={3}
                          placeholder="ej: burguerdemo"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-password">Contraseña</Label>
                        <Input
                          id="biz-password"
                          type="text"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder="mínimo 6 caracteres"
                          className="h-11"
                        />
                      </div>
                      <Button type="submit" disabled={saving} className="w-full gap-2">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Crear
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Empresa</th>
                      <th className="hidden px-6 py-4 md:table-cell">Administrador</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                          Todavía no hay empresas.
                        </td>
                      </tr>
                    )}
                    {rows.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-4 py-4 md:px-6">
                          <p className="font-semibold">{b.name}</p>
                          <code className="text-xs text-muted-foreground">{b.slug}</code>
                          {b.admin_email && (
                            <p className="text-xs text-muted-foreground md:hidden">
                              {b.admin_email}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-6 py-4 text-muted-foreground md:table-cell">
                          {b.admin_email ? (
                            <div className="flex flex-col">
                              <span>{b.admin_email}</span>
                              {b.admin_username && (
                                <code className="text-xs text-muted-foreground/70">
                                  @{b.admin_username}
                                </code>
                              )}
                            </div>
                          ) : (
                            "Sin administrador"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                              b.active
                                ? "bg-green-500/15 text-green-500"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {b.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-4 md:px-6">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleEnter(b)}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                              Entrar
                            </Button>
                            {b.admin_user_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => openEdit(b)}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Credenciales
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleToggle(b)}>
                              {b.active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciales — {editRow?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Usuario</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
                minLength={3}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nueva contraseña</Label>
              <Input
                id="edit-password"
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={6}
                placeholder="Dejar vacío para no cambiar"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={editing} className="w-full gap-2">
              {editing && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
