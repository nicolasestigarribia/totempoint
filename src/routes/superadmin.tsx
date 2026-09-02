import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, LogOut, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  createBusiness,
  listBusinesses,
  setBusinessActive,
  type BusinessRow,
} from "@/lib/api/platform.functions";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Superadmin — Burger Point" },
      {
        name: "description",
        content: "Panel del administrador general: negocios, altas y estado de cada cuenta.",
      },
      { property: "og:title", content: "Superadmin — Burger Point" },
      {
        property: "og:description",
        content: "Panel del administrador general de la plataforma Burger Point.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperadminPage,
});

function SuperadminPage() {
  const navigate = useNavigate();
  const fetchBusinesses = useServerFn(listBusinesses);
  const create = useServerFn(createBusiness);
  const toggleActive = useServerFn(setBusinessActive);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setEmail(userData.user.email ?? "");
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
  }, [navigate, fetchBusinesses]);

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
      const res = await create({ data: { name, adminEmail } });
      toast.success(
        res.tempPassword
          ? `Negocio creado. Contraseña temporal: ${res.tempPassword}`
          : "Negocio creado y asignado al usuario existente",
        { duration: 15000 },
      );
      setName("");
      setAdminEmail("");
      setOpen(false);
      await reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el negocio");
    } finally {
      setSaving(false);
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
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Plataforma</p>
              <h1 className="text-lg font-bold leading-tight">Superadmin</h1>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Negocios</h2>
            <p className="text-sm text-muted-foreground">Sesión: {email}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Crear negocio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo negocio</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="biz-name">Nombre del negocio</Label>
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
                <Button type="submit" disabled={saving} className="w-full gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Negocio</th>
                <th className="px-6 py-4">Administrador</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                    Todavía no hay negocios.
                  </td>
                </tr>
              )}
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{b.name}</p>
                    <code className="text-xs text-muted-foreground">{b.slug}</code>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {b.admin_email ?? "Sin administrador"}
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
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleToggle(b)}>
                      {b.active ? "Desactivar" : "Activar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
