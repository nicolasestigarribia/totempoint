import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, LogOut, Package, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel administrativo — Burger Point" }],
  }),
  component: AdminPage,
});

interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
}

function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [noBusiness, setNoBusiness] = useState(false);
  const [email, setEmail] = useState<string>("");

  // form fields
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      if (!mounted) return;
      setEmail(userData.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!profile?.business_id) {
        if (mounted) {
          setNoBusiness(true);
          setLoading(false);
        }
        return;
      }

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, name, slug, logo_url, primary_color, phone, address, active")
        .eq("id", profile.business_id)
        .maybeSingle();

      if (mounted && biz) {
        setBusiness(biz as Business);
        setName(biz.name ?? "");
        setLogoUrl(biz.logo_url ?? "");
        setPrimaryColor(biz.primary_color ?? "#000000");
        setPhone(biz.phone ?? "");
        setAddress(biz.address ?? "");
      } else if (mounted) {
        setNoBusiness(true);
      }
      if (mounted) setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login", replace: true });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !business.active) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          name: name.trim(),
          logo_url: logoUrl.trim() || null,
          primary_color: primaryColor || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", business.id);
      if (error) throw error;
      toast.success("Datos del negocio actualizados");
      setBusiness({ ...business, name, logo_url: logoUrl, primary_color: primaryColor, phone, address });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
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
              <Flame className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Burger Point</p>
              <h1 className="text-lg font-bold leading-tight">Panel administrativo</h1>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {noBusiness && (
          <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h2 className="text-2xl font-bold">Usuario sin negocio asignado</h2>
            <p className="mt-2 text-muted-foreground">
              Contactá al administrador de la plataforma.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Sesión: {email}</p>
          </div>
        )}

        {business && !business.active && (
          <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h2 className="text-2xl font-bold">Cuenta suspendida</h2>
            <p className="mt-2 text-muted-foreground">Contactá al administrador.</p>
          </div>
        )}

        {business && (
          <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-muted-foreground">Negocio</p>
                <h2 className="mt-2 text-4xl font-bold tracking-tight">{business.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Slug: <code className="rounded bg-muted px-2 py-0.5">{business.slug}</code>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Sesión: {email}</p>
              </div>
              <span
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
                  business.active
                    ? "bg-green-500/15 text-green-500"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                {business.active ? "Activo" : "Suspendido"}
              </span>
            </div>
          </div>
        )}

        {business && business.active && (
          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-6"
          >
            <div>
              <h3 className="text-xl font-bold">Configuración del negocio</h3>
              <p className="text-sm text-muted-foreground">
                Datos visibles para tus clientes.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nombre visible</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logo">Logo (URL)</Label>
                <Input
                  id="logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color principal</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    className="h-11 flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 11 ..."
                  className="h-11"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle 123, Ciudad"
                  className="h-11"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="h-12 gap-2 px-8 font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </form>
        )}

        {business && business.active && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 opacity-60">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Productos</h3>
                <p className="text-sm text-muted-foreground">Próximamente</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
