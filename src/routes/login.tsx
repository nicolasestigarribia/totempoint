import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Flame, Loader2, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { login, me, type AuthUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Acceso — Totempoint" }],
  }),
  component: LoginPage,
});

function destinationFor(user: AuthUser): string {
  if (user.roles.includes("superadmin")) return "/superadmin";
  if (user.roles.includes("owner") || user.roles.includes("encargado")) return "/admin";
  if (user.roles.includes("kitchen")) return "/kitchen";
  return "/admin";
}

function LoginPage() {
  const navigate = useNavigate();
  const doLogin = useServerFn(login);
  const doMe = useServerFn(me);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    doMe().then((user) => {
      if (user) navigate({ to: destinationFor(user), replace: true });
    });
  }, [doMe, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await doLogin({ data: { identifier, password } });
      navigate({ to: destinationFor(user), replace: true });
    } catch (err: any) {
      console.error("Login error detail:", err);

      let msg = "Error de autenticación. Por favor, revisá tus credenciales.";

      if (err?.message === "An error occurred in the Server Function") {
        // Este es el error genérico de TanStack Start cuando falla una Server Function
        msg =
          "No se pudo conectar con el servidor o hubo un error interno. Intentalo de nuevo en unos momentos.";
      } else if (err?.message) {
        msg = err.message;
      } else if (err?.data?.message) {
        msg = err.data.message;
      } else if (typeof err === "string") {
        msg = err;
      }

      setError(msg);
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

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email o usuario</Label>
            <Input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              placeholder="admin@negocio.com o usuario"
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
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

        {/* Todavía no hay recuperación por email: el reseteo es a mano, así que
            conviene decir a quién pedírselo en vez de dejar un mensaje genérico. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          ¿Olvidaste tu contraseña? Si sos encargado, pedísela al dueño de tu empresa, que puede
          cambiártela desde Operadores. Si sos el dueño, escribinos y te la restablecemos.
        </p>
      </div>
    </div>
  );
}
