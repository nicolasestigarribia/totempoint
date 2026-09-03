import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Acceso administrador — Burger Point" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: LoginPage,
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Email no confirmado.";
  if (m.includes("network")) return "Error de conexión. Reintentá.";
  return "No se pudo iniciar sesión. Verificá tus datos.";
}

function isSameOriginRelativePath(path: string): boolean {
  try {
    const url = new URL(path, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function useRedirectAfterLogin() {
  const navigate = useNavigate();
  return async (next?: string) => {
    if (next && isSameOriginRelativePath(next)) {
      const url = new URL(next, window.location.origin);
      await navigate({ href: url.pathname + url.search + url.hash, replace: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: session.user.id });
    await navigate({ to: isSuper ? "/superadmin" : "/admin", replace: true });
  };
}

function LoginPage() {
  const { next } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const redirectAfterLogin = useRedirectAfterLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectAfterLogin(next);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) redirectAfterLogin(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [next, redirectAfterLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await redirectAfterLogin(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Flame className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Panel Admin</h1>
          <p className="text-sm text-muted-foreground text-center">
            Iniciá sesión para gestionar tu negocio
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@negocio.com"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La contraseña debe tener al menos 12 caracteres, una mayúscula, una minúscula, un número y un símbolo.
            </p>
          </div>

          <Button type="submit" disabled={loading} className="h-12 w-full text-base font-bold">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿No tenés acceso? Contactá al administrador de la plataforma.
        </p>
      </div>
    </div>
  );
}
