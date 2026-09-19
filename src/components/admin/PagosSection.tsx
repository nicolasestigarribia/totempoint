import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Trash2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getPaymentSettings,
  updatePaymentSettings,
  clearPaymentSettings,
  type PaymentSettingsView,
} from "@/lib/api/payments.functions";
import { mensajeDeError } from "@/lib/error-message";

/**
 * Credenciales de cobro de la empresa.
 *
 * La plata entra en la cuenta del negocio, no en una de la plataforma, así que
 * acá va el access token propio de cada uno. El token no se muestra nunca
 * completo después de guardarlo: solo sus últimos caracteres, que alcanzan
 * para saber cuál está puesto.
 */
export function PagosSection({ panelClass }: { panelClass: string }) {
  const fetchSettings = useServerFn(getPaymentSettings);
  const save = useServerFn(updatePaymentSettings);
  const clear = useServerFn(clearPaymentSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettingsView | null>(null);
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);

  const cargar = async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
      setEnabled(s.mpEnabled);
      setToken("");
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cargar la configuración de cobro"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // Solo al montar: después se recarga a mano al guardar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { mpAccessToken: token || undefined, mpEnabled: enabled } });
      toast.success("Listo, quedó guardado");
      await cargar();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await clear();
      toast.success("Credenciales borradas");
      await cargar();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo borrar"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const listo = settings?.mpConfigurado && settings.mpEnabled;

  return (
    <div className="space-y-5">
      <div className={`p-6 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Cobro con Mercado Pago</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              El cliente escanea un QR en la pantalla del tótem y paga desde su celular. La plata
              entra directamente en tu cuenta de Mercado Pago: Totempoint no la toca.
            </p>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
              listo ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {listo ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {listo ? "Cobrando" : "Sin configurar"}
          </span>
        </div>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="mp-token">Access token</Label>
            <Input
              id="mp-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                settings?.mpConfigurado
                  ? `Guardado (${settings.mpTokenPista}). Escribí uno nuevo para reemplazarlo.`
                  : "APP_USR-..."
              }
              className="h-11"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Lo sacás de{" "}
              <a
                href="https://www.mercadopago.com.ar/developers/panel/app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              >
                tu panel de desarrollador de Mercado Pago
                <ExternalLink className="h-3 w-3" />
              </a>
              , en “Credenciales de producción”. Empieza con <code>APP_USR-</code>. Los de prueba
              empiezan con <code>TEST-</code> y sirven para probar sin mover plata real.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <div>
              <p className="font-medium">Cobrar desde el tótem</p>
              <p className="text-sm text-muted-foreground">
                Apagado, el tótem solo ofrece pagar en efectivo.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && !settings?.mpConfigurado && !token && (
            <p className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Falta el access token: sin eso no se puede cobrar.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
            {settings?.mpConfigurado && (
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={saving}
                className="gap-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Borrar credenciales
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={`p-6 ${panelClass}`}>
        <h4 className="font-bold">Cómo queda el circuito</h4>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. El cliente arma el pedido y elige Mercado Pago.</li>
          <li>2. El tótem muestra un QR y el cliente paga desde su celular.</li>
          <li>3. El pedido aparece en la comandera ya marcado como cobrado.</li>
          <li>
            4. Si el cobro no entra, el pedido igual queda tomado y se puede cobrar en la caja: no
            se pierde.
          </li>
        </ol>
      </div>
    </div>
  );
}
