import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FlaskConical,
} from "lucide-react";

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
 * La plata entra en la cuenta de la sucursal, no en una de la plataforma, así que
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

  // Tres estados, no dos: tener las credenciales cargadas y tener el cobro
  // prendido son cosas distintas, y juntarlas hacía que después de pegar el
  // token el cartel siguiera diciendo "sin configurar" como si no se hubiera
  // guardado nada.
  const estado = !settings?.mpConfigurado
    ? ({ texto: "Sin configurar", clase: "bg-muted text-muted-foreground" } as const)
    : settings.mpDePrueba
      ? ({ texto: "Modo prueba", clase: "bg-sky-500/15 text-sky-400" } as const)
      : settings.mpEnabled
        ? ({ texto: "Cobrando", clase: "bg-green-500/15 text-green-500" } as const)
        : ({ texto: "Apagado", clase: "bg-amber-500/15 text-amber-400" } as const);
  const listo = settings?.mpConfigurado && settings.mpEnabled;

  return (
    <div className="space-y-5">
      <div className={`p-6 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Cobro con Mercado Pago</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              El cliente paga desde su celular: en el tótem escaneando un QR, en el pedido online
              directo desde el link. La plata entra en tu cuenta de Mercado Pago: Totempoint no la
              toca.
            </p>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${estado.clase}`}
          >
            {listo ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {estado.texto}
          </span>
        </div>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="mp-token">Access token</Label>
            <Input
              id="mp-token"
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                // Nadie carga credenciales para dejarlas apagadas. El switch
                // queda para apagar el cobro después, no para tener que
                // acordarse de prenderlo la primera vez.
                if (e.target.value && !settings?.mpConfigurado) setEnabled(true);
              }}
              placeholder={
                settings?.mpConfigurado
                  ? `Guardado (${settings.mpTokenPista}). Escribí uno nuevo para reemplazarlo.`
                  : "APP_USR-..."
              }
              className="h-11"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Empieza con <code>APP_USR-</code>. Si no lo tenés, seguí la guía de abajo: son 5
              minutos.
            </p>
          </div>

          {!listo && <GuiaCredenciales />}

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <div>
              <p className="font-medium">Cobrar con Mercado Pago</p>
              <p className="text-sm text-muted-foreground">
                Apagado, tus clientes solo pueden pagar en efectivo.
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

          {settings?.mpDePrueba && (
            <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
              <p className="flex items-start gap-2 font-medium text-sky-300">
                <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
                Estas credenciales son de una cuenta de prueba de Mercado Pago.
              </p>
              <p className="mt-2 text-muted-foreground">
                Sirven para probar el circuito sin mover plata, pero{" "}
                <strong className="text-foreground">no pueden cobrarle a un cliente real</strong>: a
                una cuenta de prueba solo le puede pagar otra cuenta de prueba, y cualquier otro
                intento falla con un error genérico de Mercado Pago. Antes de abrir, cambiá el token
                por el de la cuenta real de la sucursal.
              </p>
            </div>
          )}

          {settings?.mpConfigurado && !settings.mpEnabled && (
            <p className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Las credenciales están guardadas, pero el cobro está apagado: el tótem sigue
              ofreciendo solo efectivo. Prendé el interruptor de arriba y guardá.
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

      {listo && (
        <div className={`p-6 ${panelClass}`}>
          <GuiaCredenciales cerrada />
        </div>
      )}

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

const PANEL_MP = "https://www.mercadopago.com.ar/developers/panel/app";
const AYUDA_MP = `https://wa.me/5492235924929?text=${encodeURIComponent(
  "Hola! Necesito ayuda para conectar Mercado Pago en Totempoint.",
)}`;

/**
 * Cómo sacar el Access Token, paso a paso y con el botón que lleva al lugar.
 * Lo hace el dueño del local, que no es programador: los nombres de los
 * botones son los que ve en Mercado Pago. Las credenciales de prueba también
 * empiezan con APP_USR-, así que la diferencia la marca el selector
 * "Producción", no el prefijo.
 */
function GuiaCredenciales({ cerrada = false }: { cerrada?: boolean }) {
  const [abierta, setAbierta] = useState(!cerrada);
  return (
    <div className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-bold">Cómo conseguir tu Access Token</span>
        <span className="text-xs font-bold text-sky-300">{abierta ? "Ocultar" : "Ver guía"}</span>
      </button>
      {abierta && (
        <div className="mt-3 space-y-4 text-sm">
          <ol className="space-y-3">
            <Paso n={1}>
              Entrá a Mercado Pago <b>con la cuenta donde querés recibir la plata</b> (la del
              local).
              <a
                href={PANEL_MP}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 font-bold text-white transition hover:bg-sky-400"
              >
                Abrir mi panel de Mercado Pago
                <ExternalLink className="h-4 w-4" />
              </a>
            </Paso>
            <Paso n={2}>
              Tocá <b>“Crear aplicación”</b> (o “Crear manualmente”). Ponele de nombre{" "}
              <b>Totempoint</b> y, cuando te pregunte qué vas a usar, elegí{" "}
              <b>pagos online / Checkout Pro</b>.
            </Paso>
            <Paso n={3}>
              Entrá a la aplicación que creaste. Arriba cambiá el selector a <b>“Producción”</b> y
              en el menú tocá <b>“Credenciales”</b>.
            </Paso>
            <Paso n={4}>
              Tocá <b>“Activar ambiente de producción”</b>. Te pide el rubro (elegí gastronomía) y
              el sitio web: poné el link de tu tienda online o tu Instagram. Aceptá los términos y
              tocá <b>“Activar”</b>.
            </Paso>
            <Paso n={5}>
              Copiá el <b>“Access Token”</b> (empieza con <code>APP_USR-</code>) y pegalo arriba, en
              el campo Access token. Después tocá Guardar.
            </Paso>
          </ol>
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Fijate que arriba diga <b>&nbsp;“Producción”&nbsp;</b> antes de copiarlo: el de prueba
            también empieza con APP_USR- pero no cobra plata real. Y no lo compartas con nadie: es
            la llave de tu cuenta.
          </p>
          <a
            href={AYUDA_MP}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-bold text-sky-300 underline-offset-4 hover:underline"
          >
            ¿Te trabaste? Escribinos por WhatsApp y te ayudamos
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </li>
  );
}
