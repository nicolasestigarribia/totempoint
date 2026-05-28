import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Flame, LogOut, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel administrativo — Burger Point" }],
  }),
  component: AdminPage,
});

interface BusinessInfo {
  name: string;
  slug: string;
}

function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [email, setEmail] = useState<string>("");

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

      if (profile?.business_id) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("name, slug")
          .eq("id", profile.business_id)
          .maybeSingle();
        if (mounted && biz) setBusiness(biz);
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-3xl border border-border bg-card p-8 shadow-lg">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Negocio</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight">
            {business?.name ?? "Sin negocio asignado"}
          </h2>
          {business && (
            <p className="mt-2 text-sm text-muted-foreground">
              Slug: <code className="rounded bg-muted px-2 py-0.5">{business.slug}</code>
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">Sesión: {email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            disabled
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left opacity-60"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Productos</h3>
              <p className="text-sm text-muted-foreground">Próximamente</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
