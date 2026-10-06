import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Trash2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getOnlineConfig,
  saveOnlineSettings,
  saveDeliveryOrigin,
  saveDeliveryTier,
  deleteDeliveryTier,
  type OnlineConfig,
  type OnlineLocationConfig,
  type OnlineTierView,
} from "@/lib/api/online.functions";
import { mensajeDeError } from "@/lib/error-message";
import { BuscadorDireccion } from "@/components/online/BuscadorDireccion";
import { MapaPin } from "@/components/online/MapaPin";
import type { Punto } from "@/lib/delivery";

/**
 * Pedido online: el link que el cliente abre en su celular para pedir con
 * retiro o envío, sin pasar por el WhatsApp del local.
 *
 * Una tarjeta por sucursal, porque cada una tiene su cocina, su zona de reparto
 * y sus horarios. El interruptor de arriba es el que se usa todos los días:
 * abre y cierra el canal.
 */
export function OnlineSection({ panelClass }: { panelClass: string }) {
  const fetchConfig = useServerFn(getOnlineConfig);
  const [config, setConfig] = useState<OnlineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [elegida, setElegida] = useState<number | null>(null);

  const cargar = async () => {
    try {
      const c = await fetchConfig();
      setConfig(c);
      setElegida((prev) => prev ?? c.locations[0]?.locationId ?? null);
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cargar el pedido online"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // Solo al montar: después se recarga a mano al guardar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!config || config.locations.length === 0) {
    return (
      <div className={`p-6 text-sm text-muted-foreground ${panelClass}`}>
        Primero creá una sucursal desde Empresa: el pedido online se configura por sucursal.
      </div>
    );
  }

  const loc = config.locations.find((l) => l.locationId === elegida) ?? config.locations[0];

  return (
    <div className="space-y-5">
      {config.locations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {config.locations.map((l) => (
            <button
              key={l.locationId}
              type="button"
              onClick={() => setElegida(l.locationId)}
              className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                l.locationId === loc.locationId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {l.locationName}
            </button>
          ))}
        </div>
      )}

      {/* La key reinicia el formulario al cambiar de sucursal. */}
      <SucursalOnline
        key={loc.locationId}
        loc={loc}
        companySlug={config.companySlug}
        mercadoPago={config.mercadoPago}
        panelClass={panelClass}
        onChange={cargar}
      />
    </div>
  );
}

function SucursalOnline({
  loc,
  companySlug,
  mercadoPago,
  panelClass,
  onChange,
}: {
  loc: OnlineLocationConfig;
  companySlug: string;
  mercadoPago: boolean;
  panelClass: string;
  onChange: () => Promise<void>;
}) {
  const save = useServerFn(saveOnlineSettings);
  const [enabled, setEnabled] = useState(loc.enabled);
  const [pickup, setPickup] = useState(loc.pickupEnabled);
  const [delivery, setDelivery] = useState(loc.deliveryEnabled);
  const [cash, setCash] = useState(loc.cashEnabled);
  const [minOrder, setMinOrder] = useState(String(Number(loc.minOrder) || ""));
  const [saving, setSaving] = useState(false);

  const faltaParaEnvio = !loc.origin
    ? "Marcá abajo en el mapa dónde está la sucursal: sin eso no se puede medir la distancia de los envíos."
    : loc.tiers.length === 0
      ? "Cargá al menos un tramo de costo abajo: sin tramos no hay hasta dónde llegar ni qué cobrar."
      : null;

  const guardar = async (cambios?: { enabled?: boolean }) => {
    setSaving(true);
    try {
      await save({
        data: {
          locationId: loc.locationId,
          enabled: cambios?.enabled ?? enabled,
          pickupEnabled: pickup,
          deliveryEnabled: delivery,
          cashEnabled: cash,
          minOrder: Math.max(0, Number(minOrder) || 0),
        },
      });
      toast.success("Listo, quedó guardado");
      await onChange();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar"));
      if (cambios?.enabled !== undefined) setEnabled(!cambios.enabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`p-6 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Pedido online · {loc.locationName}</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Tus clientes piden desde el celular con el mismo menú del tótem, y el pedido te llega
              a la comandera para que lo aceptes. Sin escribir por WhatsApp ni tomar nota a mano.
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
              loc.enabled ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {loc.enabled ? "Tomando pedidos" : "Cerrado"}
          </span>
        </div>

        {/* El interruptor que se usa todos los días: se guarda solo al tocarlo,
            sin tener que bajar a buscar el botón. */}
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
          <div>
            <p className="font-medium">Tomar pedidos ahora</p>
            <p className="text-sm text-muted-foreground">
              Apagado, el link muestra que en este momento no están tomando pedidos.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={(v) => {
              setEnabled(v);
              void guardar({ enabled: v });
            }}
          />
        </div>
      </div>

      <LinkOnline empresa={companySlug} local={loc.locationSlug} panelClass={panelClass} />

      <div className={`space-y-4 p-6 ${panelClass}`}>
        <h4 className="font-bold">Cómo lo entregan y cómo lo cobran</h4>

        <Opcion
          titulo="Retiro en el local"
          detalle="El cliente pide desde donde esté y pasa a buscarlo."
          checked={pickup}
          onChange={setPickup}
        />
        <Opcion
          titulo="Envío"
          detalle="Se lo llevan. El cliente marca su dirección en el mapa y el costo sale de la distancia."
          checked={delivery}
          onChange={setDelivery}
        />
        {delivery && faltaParaEnvio && (
          <p className="flex items-start gap-2 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {faltaParaEnvio}
          </p>
        )}
        <Opcion
          titulo="Efectivo"
          detalle="Paga al retirar o al recibir. Le preguntamos con cuánto paga para llevar el vuelto."
          checked={cash}
          onChange={setCash}
        />
        <p className="text-sm text-muted-foreground">
          Mercado Pago:{" "}
          {mercadoPago ? (
            <span className="text-green-500">activo, el cliente paga desde su celular.</span>
          ) : (
            <span>no está configurado. Se activa en Caja → Cobros.</span>
          )}
        </p>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="min-order">Pedido mínimo (sin contar el envío)</Label>
          <Input
            id="min-order"
            type="number"
            inputMode="numeric"
            min={0}
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            placeholder="Sin mínimo"
            className="h-11"
          />
        </div>

        <Button onClick={() => guardar()} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      <EnviosPorDistancia loc={loc} panelClass={panelClass} onChange={onChange} />
    </>
  );
}

function Opcion({
  titulo,
  detalle,
  checked,
  onChange,
}: {
  titulo: string;
  detalle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** El link para pegar como respuesta rápida de WhatsApp, y su QR para el mostrador. */
function LinkOnline({
  empresa,
  local,
  panelClass,
}: {
  empresa: string;
  local: string;
  panelClass: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const path = `/p/${empresa}/${local}`;
  const url = origin ? `${origin}${path}` : path;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };

  return (
    <div className={`p-6 ${panelClass}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="font-bold">El link para pedir</p>
          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="h-11 flex-1"
            />
            <Button type="button" variant="outline" className="h-11 gap-2" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition hover:border-primary"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir
            </a>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Guardalo como respuesta rápida en WhatsApp Business (por ejemplo, /pedido): a cada
            mensaje de pedido le contestás con el link y el cliente arma su pedido solo.
          </p>
        </div>
        {/* Fondo blanco fijo: un QR sobre el panel oscuro no lo lee ninguna cámara. */}
        <div className="mx-auto shrink-0 rounded-2xl bg-white p-3 sm:mx-0">
          <QRCodeSVG value={url} size={140} level="M" />
        </div>
      </div>
    </div>
  );
}

/**
 * Desde dónde salen los envíos y cuánto cuestan según la distancia. Es lo que
 * reemplaza a las zonas: el cliente marca su dirección y el sistema mide.
 */
function EnviosPorDistancia({
  loc,
  panelClass,
  onChange,
}: {
  loc: OnlineLocationConfig;
  panelClass: string;
  onChange: () => Promise<void>;
}) {
  const saveOrigin = useServerFn(saveDeliveryOrigin);
  const save = useServerFn(saveDeliveryTier);
  // El punto mientras se ajusta, antes de guardarlo.
  const [punto, setPunto] = useState<Punto | null>(loc.origin);
  const [guardandoPunto, setGuardandoPunto] = useState(false);
  const [km, setKm] = useState("");
  const [precio, setPrecio] = useState("");
  const [agregando, setAgregando] = useState(false);

  // Se compara con la precisión que guarda la base (6 decimales): si no, el pin
  // recién guardado seguía pareciendo distinto y el botón no se iba.
  const igual = (a: number, b: number | undefined) =>
    b !== undefined && Math.abs(a - b) < 0.0000005;
  const puntoCambiado =
    punto !== null && (!igual(punto.lat, loc.origin?.lat) || !igual(punto.lng, loc.origin?.lng));
  const alcance = loc.tiers.length > 0 ? Math.max(...loc.tiers.map((t) => t.upToKm)) : null;

  const guardarPunto = async () => {
    if (!punto) return;
    setGuardandoPunto(true);
    try {
      await saveOrigin({ data: { locationId: loc.locationId, lat: punto.lat, lng: punto.lng } });
      toast.success("Ubicación de la sucursal guardada");
      await onChange();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar la ubicación"));
    } finally {
      setGuardandoPunto(false);
    }
  };

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!km || precio === "") return;
    const kmN = Number(km);
    const precioN = Number(precio);
    if (!(kmN > 0)) {
      toast.error("Los km tienen que ser mayores a 0");
      return;
    }
    if (Number.isNaN(precioN) || precioN < 0) {
      toast.error("El costo de envío no puede ser negativo");
      return;
    }
    setAgregando(true);
    try {
      await save({
        data: { locationId: loc.locationId, upToKm: kmN, price: precioN },
      });
      setKm("");
      setPrecio("");
      await onChange();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo agregar el tramo"));
    } finally {
      setAgregando(false);
    }
  };

  return (
    <div className={`space-y-6 p-6 ${panelClass}`}>
      <div className="space-y-3">
        <div>
          <h4 className="font-bold">Desde dónde salen los envíos</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Marcá la sucursal en el mapa: desde ese punto se mide la distancia hasta cada cliente.
            {loc.locationAddress && ` La dirección cargada es ${loc.locationAddress}.`}
          </p>
        </div>

        <BuscadorDireccion
          cerca={punto}
          placeholder="Buscar la dirección de la sucursal"
          inputClassName="h-11 rounded-xl"
          onElegir={(l) => setPunto({ lat: l.lat, lng: l.lng })}
        />

        {punto && (
          <>
            <MapaPin
              pin={punto}
              onMover={setPunto}
              origen={loc.origin}
              alcanceKm={alcance}
              className="h-72"
            />
            <p className="text-xs text-muted-foreground">
              Mové el pin, o tocá el mapa, hasta la puerta de la sucursal.
              {alcance && " El círculo es hasta dónde llegan los envíos."}
            </p>
          </>
        )}

        {puntoCambiado && (
          <Button onClick={guardarPunto} disabled={guardandoPunto} className="gap-2">
            {guardandoPunto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar ubicación
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="font-bold">Costo del envío según la distancia</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Por ejemplo: hasta 2 km $1.500, hasta 4 km $2.500. El tramo más largo es hasta dónde
            llegan: a un cliente más lejos se le avisa que no hacen envíos hasta ahí.
          </p>
        </div>

        {loc.tiers.length > 0 && (
          <ul className="space-y-2">
            {loc.tiers.map((t) => (
              <FilaTramo key={t.id} tramo={t} locationId={loc.locationId} onChange={onChange} />
            ))}
          </ul>
        )}

        <form onSubmit={agregar} className="flex flex-wrap items-end gap-2">
          <div className="w-32 space-y-1">
            <Label htmlFor="tramo-km">Hasta (km)</Label>
            <Input
              id="tramo-km"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="2"
              className="h-11"
            />
          </div>
          <div className="w-36 space-y-1">
            <Label htmlFor="tramo-precio">Costo</Label>
            <Input
              id="tramo-precio"
              type="number"
              inputMode="numeric"
              min={0}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="1500"
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={agregando || !km || precio === ""} className="h-11 gap-2">
            {agregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Agregar tramo
          </Button>
        </form>
      </div>
    </div>
  );
}

function FilaTramo({
  tramo,
  locationId,
  onChange,
}: {
  tramo: OnlineTierView;
  locationId: number;
  onChange: () => Promise<void>;
}) {
  const save = useServerFn(saveDeliveryTier);
  const remove = useServerFn(deleteDeliveryTier);
  const [km, setKm] = useState(String(tramo.upToKm));
  const [precio, setPrecio] = useState(String(tramo.price));
  const [ocupado, setOcupado] = useState(false);

  const cambio = Number(km) !== tramo.upToKm || Number(precio) !== tramo.price;

  const guardar = async () => {
    const kmN = Number(km);
    const precioN = Number(precio) || 0;
    if (!(kmN > 0)) {
      toast.error("Los km tienen que ser mayores a 0");
      return;
    }
    if (precioN < 0) {
      toast.error("El costo de envío no puede ser negativo");
      return;
    }
    setOcupado(true);
    try {
      await save({
        data: { locationId, id: tramo.id, upToKm: kmN, price: precioN },
      });
      await onChange();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar el tramo"));
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    setOcupado(true);
    try {
      await remove({ data: { locationId, id: tramo.id } });
      await onChange();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo borrar el tramo"));
      setOcupado(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
      <span className="text-sm text-muted-foreground">Hasta</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0.1}
        step={0.1}
        value={km}
        onChange={(e) => setKm(e.target.value)}
        aria-label="Hasta cuántos km"
        className="h-10 w-24"
      />
      <span className="text-sm text-muted-foreground">km →</span>
      <span className="text-muted-foreground">$</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        aria-label="Costo del envío"
        className="h-10 w-28"
      />
      {cambio && (
        <Button size="sm" onClick={guardar} disabled={ocupado} className="gap-1">
          <Save className="h-4 w-4" />
          Guardar
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={borrar}
        disabled={ocupado}
        aria-label={`Borrar el tramo hasta ${tramo.upToKm} km`}
        className="ml-auto text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
