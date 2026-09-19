import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Eye, EyeOff, AlertCircle, KeyRound, Check } from "lucide-react";
import { toast } from "sonner";
import { me, changeMyPassword, type AuthUser } from "@/lib/api/auth.functions";
import { checkPassword, PASSWORD_HINT } from "@/lib/auth/password-policy";
import { mensajeDeError } from "@/lib/error-message";

export const Route = createFileRoute("/cuenta")({
  head: () => ({
    meta: [{ title: "Mi cuenta — Totempoint" }],
  }),
  component: CuentaPage,
});

/** A dónde vuelve cada uno cuando termina: la pantalla en la que trabaja. */
function volverA(user: AuthUser): string {
  if (user.roles.includes("superadmin")) return "/superadmin";
  if (user.roles.includes("kitchen") && !user.roles.includes("owner")) return "/kitchen";
  return "/admin";
}

function CuentaPage() {
  const navigate = useNavigate();
  const doMe = useServerFn(me);
  const doChange = useServerFn(changeMyPassword);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);

  useEffect(() => {
    let vivo = true;
    doMe().then((u) => {
      if (!vivo) return;
      if (!u) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [doMe, navigate]);

  // Se avisa mientras escribe, no al apretar Guardar: la regla es la misma que
  // valida el servidor, así que no puede pasar una y fallar la otra.
  const problemas = nueva ? checkPassword(nueva).problemas : [];
  const coinciden = nueva.length > 0 && nueva === repetir;
  const puedeGuardar = actual.length > 0 && problemas.length === 0 && coinciden && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setSaving(true);
    setError(null);
    try {
      await doChange({ data: { currentPassword: actual, newPassword: nueva } });
      toast.success("Listo, tu contraseña quedó cambiada");
      setActual("");
      setNueva("");
      setRepetir("");
      if (user) navigate({ to: volverA(user), replace: true });
    } catch (err: unknown) {
      setError(mensajeDeError(err, "No se pudo cambiar la contraseña"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <button
          type="button"
          onClick={() => user && navigate({ to: volverA(user) })}
          className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="rounded-3xl border border-white/10 bg-[oklch(0.17_0.015_20)] p-6 shadow-lg shadow-black/40 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
              <KeyRound className="h-5 w-5 text-primary" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mi cuenta</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="actual">Contraseña actual</Label>
              <div className="relative">
                <Input
                  id="actual"
                  type={verActual ? "text" : "password"}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerActual((v) => !v)}
                  aria-label={verActual ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {verActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nueva">Contraseña nueva</Label>
              <div className="relative">
                <Input
                  id="nueva"
                  type={verNueva ? "text" : "password"}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  placeholder={PASSWORD_HINT}
                  className="h-11 pr-11"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerNueva((v) => !v)}
                  aria-label={verNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {verNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {problemas.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {problemas.map((p) => (
                    <li key={p} className="text-xs text-amber-400">
                      • {p}
                    </li>
                  ))}
                </ul>
              )}
              {nueva.length > 0 && problemas.length === 0 && (
                <p className="flex items-center gap-1 pt-1 text-xs text-green-400">
                  <Check className="h-3 w-3" /> Contraseña válida
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="repetir">Repetir la nueva</Label>
              <Input
                id="repetir"
                type={verNueva ? "text" : "password"}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                placeholder="••••••••"
                className="h-11"
                autoComplete="new-password"
              />
              {repetir.length > 0 && !coinciden && (
                <p className="pt-1 text-xs text-amber-400">Las dos no coinciden</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Al cambiarla se cierran las sesiones que tengas abiertas en otros dispositivos. En
              este seguís adentro.
            </p>

            <Button type="submit" disabled={!puedeGuardar} className="h-12 w-full gap-2 font-bold">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Cambiar contraseña
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
