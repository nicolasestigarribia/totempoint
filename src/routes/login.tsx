import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { login, me, type AuthUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Acceso administrador — Burger Point" }],
  }),
  component: LoginPage,
});

function destinationFor(user: AuthUser): string {
  return user.roles.includes("superadmin") ? "/superadmin" : "/admin";
}

function LoginPage() {
  const navigate = useNavigate();
  const doLogin = useServerFn(login);
  const doMe = useServerFn(me);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    doMe().then((user) => {
      if (user) navigate({ to: destinationFor(user), replace: true });
    });
  }, [doMe, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await doLogin({ data: { email, password } });
      navigate({ to: destinationFor(user), replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Link
        to="/"
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur transition hover:border-primary hover:text-foreground md:left-12 md:top-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>
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
