import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QrConLogo } from "@/components/QrConLogo";
import { toast } from "sonner";
import {
  Armchair,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Minus,
  MoveDiagonal2,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useReadOnly } from "@/components/admin/readonly";
import { listLocations, type LocationRow } from "@/lib/api/locations.functions";
import {
  getSalon,
  saveSalon,
  setMesaAutoAccept,
  setMesaEfectivo,
  type MesaRow,
} from "@/lib/api/salon.functions";
import { mensajeDeError } from "@/lib/error-message";
import {
  COLUMNAS,
  FILAS,
  LUGARES_MAX,
  LUGARES_MIN,
  MESA_MAX,
  SALON_MAX,
  libre,
  primerHueco,
  proximoNumero,
  salonMinimo,
  tamanioInicial,
  type Forma,
  type Salon,
} from "@/lib/salon";

/** Una mesa en el editor. `clave` identifica también a las que todavía no se guardaron. */
interface MesaEditor {
  clave: string;
  id?: number;
  token?: string;
  number: number;
  seats: number;
  shape: Forma;
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
}

const desdeServidor = (m: MesaRow): MesaEditor => ({ ...m, clave: `id-${m.id}` });

const NOMBRE_FORMA: Record<Forma, string> = {
  redonda: "Redonda",
  cuadrada: "Cuadrada",
  rectangular: "Rectangular",
};

/** La URL que va en el QR de una mesa. */
const urlDeMesa = (origin: string, token: string) => `${origin}/m/${token}`;

/**
 * El editor del salón: una grilla donde el dueño ubica las mesas arrastrándolas,
 * con su número y sus lugares, y de donde saca el QR de cada una.
 *
 * El arrastre es con Pointer Events, sin librería: anda igual con mouse y con
 * el dedo en una tablet, y lo único que hace falta es pasar píxeles a celdas.
 * La mesa encaja en la celda al soltarla; si cae encima de otra o afuera,
 * vuelve a donde estaba. La mesa elegida se estira desde su esquina, y el
 * salón desde la suya o con los botones de ancho y largo: el tamaño de una
 * mesa es del dibujo, no cambia sus lugares. Nada se guarda hasta tocar
 * "Guardar salón".
 */
export function SalonSection({
  panelClass,
  esDueno,
}: {
  panelClass: string;
  /** El switch de aceptación es de toda la empresa: solo lo cambia el dueño. */
  esDueno: boolean;
}) {
  const soloVer = useReadOnly();
  const fetchLocations = useServerFn(listLocations);
  const fetchSalon = useServerFn(getSalon);
  const doSave = useServerFn(saveSalon);
  const doAutoAccept = useServerFn(setMesaAutoAccept);
  const doEfectivo = useServerFn(setMesaEfectivo);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [mesas, setMesas] = useState<MesaEditor[]>([]);
  const [salon, setSalon] = useState<Salon>({ columnas: COLUMNAS, filas: FILAS });
  const [autoAccept, setAutoAccept] = useState(true);
  const [efectivo, setEfectivo] = useState(true);
  const [mercadoPago, setMercadoPago] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<MesaEditor | null>(null);
  const [origin, setOrigin] = useState("");
  // Las mesas que había al cargar: el servidor rechaza guardar si desde
  // entonces otra pestaña agregó alguna, para no borrarla sin verla.
  const [idsConocidos, setIdsConocidos] = useState<number[]>([]);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await fetchLocations();
        if (!vivo) return;
        setLocations(data);
        if (data.length > 0) setLocationId(data[0].id);
        else setCargando(false);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudieron cargar las sucursales"));
        setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [fetchLocations]);

  useEffect(() => {
    if (locationId === null) return;
    let vivo = true;
    setCargando(true);
    (async () => {
      try {
        const salon = await fetchSalon({ data: { locationId } });
        if (!vivo) return;
        setMesas(salon.mesas.map(desdeServidor));
        setSalon({ columnas: salon.columnas, filas: salon.filas });
        setIdsConocidos(salon.mesas.map((m) => m.id));
        setAutoAccept(salon.autoAccept);
        setEfectivo(salon.efectivo);
        setMercadoPago(salon.mercadoPago);
        setSeleccionada(null);
        setSinGuardar(false);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo cargar el salón"));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [locationId, fetchSalon]);

  // Cerrar la pestaña con cambios sin guardar los perdería sin aviso.
  useEffect(() => {
    if (!sinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  const cambiar = (nuevas: MesaEditor[]) => {
    setMesas(nuevas);
    setSinGuardar(true);
  };

  const otrasQue = (clave: string) => mesas.filter((m) => m.clave !== clave);

  /**
   * Agranda o achica el salón. No se achica más allá de la última mesa: una
   * mesa que quedara afuera no se podría ni ver ni guardar.
   */
  const redimensionarSalon = (nuevo: Salon) => {
    const min = salonMinimo(mesas);
    const ajustado = {
      columnas: Math.min(SALON_MAX.columnas, Math.max(min.columnas, nuevo.columnas)),
      filas: Math.min(SALON_MAX.filas, Math.max(min.filas, nuevo.filas)),
    };
    if (ajustado.columnas === salon.columnas && ajustado.filas === salon.filas) return;
    setSalon(ajustado);
    setSinGuardar(true);
  };

  const agregar = () => {
    const { w, h } = tamanioInicial("cuadrada", 4);
    const hueco = primerHueco(w, h, mesas, salon);
    if (!hueco) {
      toast.error("No queda lugar en el salón. Mové o achicá alguna mesa");
      return;
    }
    const nueva: MesaEditor = {
      clave: `nueva-${crypto.randomUUID()}`,
      number: proximoNumero(mesas),
      seats: 4,
      shape: "cuadrada",
      ...hueco,
      w,
      h,
      active: true,
    };
    cambiar([...mesas, nueva]);
    setSeleccionada(nueva.clave);
  };

  /** Aplica un cambio a una mesa si sigue entrando sin pisar a otra. */
  const editar = (clave: string, cambio: Partial<MesaEditor>): boolean => {
    const actual = mesas.find((m) => m.clave === clave);
    if (!actual) return false;
    const propuesta = { ...actual, ...cambio };
    if (!libre(propuesta, otrasQue(clave), salon)) {
      toast.error("Así no entra: pisaría otra mesa o quedaría afuera del salón");
      return false;
    }
    cambiar(mesas.map((m) => (m.clave === clave ? propuesta : m)));
    return true;
  };

  const borrar = (m: MesaEditor) => {
    cambiar(mesas.filter((x) => x.clave !== m.clave));
    setSeleccionada(null);
    setABorrar(null);
  };

  const guardar = async () => {
    if (locationId === null) return;
    setGuardando(true);
    try {
      const guardadas = await doSave({
        data: {
          locationId,
          idsConocidos,
          columnas: salon.columnas,
          filas: salon.filas,
          mesas: mesas.map(({ id, number, seats, shape, x, y, w, h, active }) => ({
            id,
            number,
            seats,
            shape,
            x,
            y,
            w,
            h,
            active,
          })),
        },
      });
      // Las nuevas vuelven con id y token; la selección se mantiene por número.
      const numeroSeleccionado = mesas.find((m) => m.clave === seleccionada)?.number;
      const nuevas = guardadas.map(desdeServidor);
      setMesas(nuevas);
      setIdsConocidos(guardadas.map((m) => m.id));
      setSeleccionada(nuevas.find((m) => m.number === numeroSeleccionado)?.clave ?? null);
      setSinGuardar(false);
      toast.success("Salón guardado");
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo guardar el salón"));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarAutoAccept = async (valor: boolean) => {
    setAutoAccept(valor);
    try {
      await doAutoAccept({ data: { autoAccept: valor } });
      toast.success(
        valor
          ? "Los pedidos de mesa van directo a la cocina"
          : "Los pedidos de mesa esperan que alguien los acepte",
      );
    } catch (err) {
      setAutoAccept(!valor);
      toast.error(mensajeDeError(err, "No se pudo cambiar"));
    }
  };

  const cambiarEfectivo = async (valor: boolean) => {
    setEfectivo(valor);
    try {
      await doEfectivo({ data: { efectivo: valor } });
      toast.success(
        valor
          ? "Desde la mesa se puede pagar en efectivo"
          : "Desde la mesa se paga solo con Mercado Pago",
      );
    } catch (err) {
      setEfectivo(!valor);
      toast.error(mensajeDeError(err, "No se pudo cambiar"));
    }
  };

  const imprimir = () => {
    const guardadas = mesas.filter((m) => m.token && m.active);
    const hoja = document.getElementById("salon-qrs-para-imprimir");
    if (guardadas.length === 0 || !hoja) {
      toast.error("No hay mesas guardadas y activas para imprimir");
      return;
    }
    const ventana = window.open("", "_blank");
    if (!ventana) {
      toast.error("El navegador bloqueó la ventana de impresión");
      return;
    }
    ventana.document
      .write(`<!doctype html><html><head><meta charset="utf-8"><title>QR de las mesas</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; }
        .hoja { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12mm; padding: 12mm; }
        .tarjeta { border: 1px dashed #999; border-radius: 6mm; padding: 8mm; text-align: center; break-inside: avoid; }
        .tarjeta svg { width: 55mm; height: 55mm; }
        .mesa { font-size: 28pt; font-weight: 800; margin: 0 0 2mm; }
        .ayuda { font-size: 12pt; margin: 3mm 0 0; color: #333; }
      </style></head><body>${hoja.innerHTML}</body></html>`);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  };

  if (cargando && locations.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div
        className={`flex flex-col items-center gap-2 p-10 text-center text-muted-foreground ${panelClass}`}
      >
        <MapPin className="h-8 w-8 opacity-40" />
        <span>Primero creá una sucursal en la sección Sucursales.</span>
      </div>
    );
  }

  const mesaSeleccionada = mesas.find((m) => m.clave === seleccionada) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm text-muted-foreground">Sucursal:</Label>
        <Select
          value={locationId === null ? "" : String(locationId)}
          onValueChange={(v) => setLocationId(Number(v))}
          disabled={sinGuardar}
        >
          <SelectTrigger
            className="h-10 w-64"
            title={sinGuardar ? "Guardá el salón antes de cambiar de sucursal" : undefined}
          >
            <SelectValue placeholder="Elegí una sucursal" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={imprimir}>
            <Printer className="h-4 w-4" />
            Imprimir QRs
          </Button>
          {!soloVer && (
            <>
              <Button variant="outline" className="gap-2" onClick={agregar}>
                <Plus className="h-4 w-4" />
                Agregar mesa
              </Button>
              <Button className="gap-2" onClick={guardar} disabled={!sinGuardar || guardando}>
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar salón
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-3 p-4 ${panelClass}`}>
        <Switch
          id="auto-accept"
          checked={autoAccept}
          onCheckedChange={cambiarAutoAccept}
          disabled={soloVer || !esDueno}
        />
        <Label htmlFor="auto-accept" className="cursor-pointer">
          Aceptar pedidos de mesa automáticamente
        </Label>
        <span className="text-xs text-muted-foreground">
          {autoAccept
            ? "Entran directo a la cocina, como los del tótem."
            : "Esperan en «Por aceptar» de la comandera hasta que alguien los acepte."}
        </span>
      </div>

      <div className={`flex flex-wrap items-center gap-3 p-4 ${panelClass}`}>
        <Switch
          id="mesa-efectivo"
          checked={efectivo}
          onCheckedChange={cambiarEfectivo}
          // Siempre tiene que quedar una forma de pago: sin Mercado Pago, el efectivo no se apaga.
          disabled={soloVer || !esDueno || !mercadoPago}
        />
        <Label htmlFor="mesa-efectivo" className="cursor-pointer">
          Aceptar pago en efectivo en la mesa
        </Label>
        <span className="text-xs text-muted-foreground">
          {!mercadoPago
            ? "Conectá Mercado Pago en Cobros para poder cobrar solo con Mercado Pago."
            : efectivo
              ? "El cliente elige Mercado Pago o efectivo, y el efectivo lo paga en el mostrador."
              : "Solo Mercado Pago: el pedido entra a la cocina cuando se acredita el pago."}
        </span>
      </div>

      {sinGuardar && (
        <p className="text-sm font-medium text-amber-500">
          Hay cambios sin guardar. Los QR de las mesas nuevas aparecen al guardar.
        </p>
      )}

      {cargando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
          <Plano
            mesas={mesas}
            salon={salon}
            onRedimensionarSalon={redimensionarSalon}
            onRedimensionarMesa={(clave, w, h) => editar(clave, { w, h })}
            seleccionada={seleccionada}
            soloVer={soloVer}
            onSeleccionar={setSeleccionada}
            onMover={(clave, x, y) => editar(clave, { x, y })}
            panelClass={panelClass}
          />

          {mesaSeleccionada ? (
            <PanelMesa
              key={mesaSeleccionada.clave}
              mesa={mesaSeleccionada}
              origin={origin}
              soloVer={soloVer}
              panelClass={panelClass}
              numerosOcupados={otrasQue(mesaSeleccionada.clave).map((m) => m.number)}
              onEditar={(cambio) => editar(mesaSeleccionada.clave, cambio)}
              onBorrar={() => setABorrar(mesaSeleccionada)}
              onCerrar={() => setSeleccionada(null)}
            />
          ) : (
            <div className={`p-5 text-sm text-muted-foreground ${panelClass}`}>
              {mesas.length === 0
                ? soloVer
                  ? "Esta sucursal todavía no tiene mesas."
                  : "Todavía no hay mesas. Tocá «Agregar mesa» y arrastrala a su lugar."
                : soloVer
                  ? "Tocá una mesa para ver su QR."
                  : "Arrastrá las mesas para ubicarlas. Tocá una para cambiarle el número, los lugares o ver su QR."}
            </div>
          )}
        </div>
      )}

      {/* Lo que se imprime: una tarjeta por mesa guardada. Oculto en el panel. */}
      <div id="salon-qrs-para-imprimir" className="hidden">
        <div className="hoja">
          {mesas
            .filter((m) => m.token && m.active)
            .sort((a, b) => a.number - b.number)
            .map((m) => (
              <div key={m.clave} className="tarjeta">
                <p className="mesa">Mesa {m.number}</p>
                <QrConLogo value={urlDeMesa(origin, m.token!)} size={256} marginSize={1} />
                <p className="ayuda">Escaneá para ver el menú y pedir</p>
              </div>
            ))}
        </div>
      </div>

      <AlertDialog open={aBorrar !== null} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la mesa {aBorrar?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Su QR deja de tomar pedidos cuando guardes el salón. Los pedidos que ya hizo esa mesa
              no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => aBorrar && borrar(aBorrar)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Lo que se está arrastrando: una mesa entera, su esquina, o la esquina del salón. */
type Arrastre =
  | {
      modo: "mover" | "estirar";
      clave: string;
      pointerId: number;
      inicioX: number;
      inicioY: number;
      /** Tamaño de la celda al empezar, en píxeles. */
      celda: number;
      desde: { x: number; y: number; w: number; h: number };
      /** Cómo quedaría si se suelta ahora. */
      x: number;
      y: number;
      w: number;
      h: number;
      movio: boolean;
    }
  | {
      modo: "salon";
      pointerId: number;
      inicioX: number;
      inicioY: number;
      celda: number;
      desde: Salon;
      columnas: number;
      filas: number;
    };

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * La grilla con las mesas. Arrastrar una mesa la mueve; tocarla sin mover la
 * elige; la esquina de abajo a la derecha de la elegida la estira, y la del
 * salón lo agranda o achica.
 */
function Plano({
  mesas,
  salon,
  seleccionada,
  soloVer,
  onSeleccionar,
  onMover,
  onRedimensionarMesa,
  onRedimensionarSalon,
  panelClass,
}: {
  mesas: MesaEditor[];
  salon: Salon;
  seleccionada: string | null;
  soloVer: boolean;
  onSeleccionar: (clave: string | null) => void;
  onMover: (clave: string, x: number, y: number) => boolean;
  onRedimensionarMesa: (clave: string, w: number, h: number) => boolean;
  onRedimensionarSalon: (salon: Salon) => void;
  panelClass: string;
}) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  // Mientras se estira el salón se dibuja con el tamaño que tendría.
  const vista: Salon =
    arrastre?.modo === "salon" ? { columnas: arrastre.columnas, filas: arrastre.filas } : salon;
  const minimo = salonMinimo(mesas);

  const celda = () => (lienzo.current?.getBoundingClientRect().width ?? 1) / salon.columnas;

  const empezar = (e: React.PointerEvent, m: MesaEditor, modo: "mover" | "estirar") => {
    e.stopPropagation();
    if (soloVer) {
      onSeleccionar(m.clave);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({
      modo,
      clave: m.clave,
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      celda: celda(),
      desde: { x: m.x, y: m.y, w: m.w, h: m.h },
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      movio: false,
    });
  };

  const empezarSalon = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({
      modo: "salon",
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      celda: celda(),
      desde: salon,
      columnas: salon.columnas,
      filas: salon.filas,
    });
  };

  const mover = (e: React.PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    const dx = Math.round((e.clientX - arrastre.inicioX) / arrastre.celda);
    const dy = Math.round((e.clientY - arrastre.inicioY) / arrastre.celda);
    if (arrastre.modo === "salon") {
      setArrastre({
        ...arrastre,
        columnas: limitar(arrastre.desde.columnas + dx, minimo.columnas, SALON_MAX.columnas),
        filas: limitar(arrastre.desde.filas + dy, minimo.filas, SALON_MAX.filas),
      });
      return;
    }
    // Unos píxeles de tolerancia: un toque con el dedo siempre se mueve algo.
    const movio =
      arrastre.movio || Math.hypot(e.clientX - arrastre.inicioX, e.clientY - arrastre.inicioY) > 6;
    if (arrastre.modo === "mover") {
      setArrastre({ ...arrastre, x: arrastre.desde.x + dx, y: arrastre.desde.y + dy, movio });
    } else {
      setArrastre({
        ...arrastre,
        w: limitar(arrastre.desde.w + dx, 1, MESA_MAX),
        h: limitar(arrastre.desde.h + dy, 1, MESA_MAX),
        movio,
      });
    }
  };

  const soltar = (e: React.PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    if (arrastre.modo === "salon") {
      onRedimensionarSalon({ columnas: arrastre.columnas, filas: arrastre.filas });
    } else if (!arrastre.movio) {
      onSeleccionar(arrastre.clave);
    } else if (arrastre.modo === "mover") {
      if (arrastre.x !== arrastre.desde.x || arrastre.y !== arrastre.desde.y)
        onMover(arrastre.clave, arrastre.x, arrastre.y);
    } else if (arrastre.w !== arrastre.desde.w || arrastre.h !== arrastre.desde.h) {
      onRedimensionarMesa(arrastre.clave, arrastre.w, arrastre.h);
    }
    setArrastre(null);
  };

  const eventos = {
    onPointerMove: mover,
    onPointerUp: soltar,
    onPointerCancel: () => setArrastre(null),
  };

  return (
    <div className={`p-3 ${panelClass}`}>
      {/* El tamaño del salón también con botones: estirar la esquina con el
          dedo en un celular es justo, y así queda dicho cuánto mide. */}
      {!soloVer && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="font-medium text-muted-foreground">Tamaño del salón</span>
          <Paso
            label="Ancho"
            valor={salon.columnas}
            onMenos={() => onRedimensionarSalon({ ...salon, columnas: salon.columnas - 1 })}
            onMas={() => onRedimensionarSalon({ ...salon, columnas: salon.columnas + 1 })}
            puedeMenos={salon.columnas > minimo.columnas}
            puedeMas={salon.columnas < SALON_MAX.columnas}
          />
          <Paso
            label="Largo"
            valor={salon.filas}
            onMenos={() => onRedimensionarSalon({ ...salon, filas: salon.filas - 1 })}
            onMas={() => onRedimensionarSalon({ ...salon, filas: salon.filas + 1 })}
            puedeMenos={salon.filas > minimo.filas}
            puedeMas={salon.filas < SALON_MAX.filas}
          />
        </div>
      )}

      <div
        ref={lienzo}
        onPointerDown={() => onSeleccionar(null)}
        className="relative w-full select-none rounded-lg border border-border bg-muted/30"
        style={{
          aspectRatio: `${vista.columnas} / ${vista.filas}`,
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: `${100 / vista.columnas}% ${100 / vista.filas}%`,
        }}
      >
        {mesas.map((m) => {
          const propia = arrastre && arrastre.modo !== "salon" && arrastre.clave === m.clave;
          const x = propia ? arrastre.x : m.x;
          const y = propia ? arrastre.y : m.y;
          const w = propia ? arrastre.w : m.w;
          const h = propia ? arrastre.h : m.h;
          const cae =
            !propia ||
            libre(
              { ...m, x, y, w, h },
              mesas.filter((o) => o.clave !== m.clave),
              vista,
            );
          const elegida = seleccionada === m.clave;
          return (
            <div
              key={m.clave}
              onPointerDown={(e) => empezar(e, m, "mover")}
              {...eventos}
              className={`absolute flex p-[3px] ${soloVer ? "cursor-pointer" : "cursor-grab"} ${propia ? "z-10 cursor-grabbing" : ""}`}
              style={{
                left: `${(x / vista.columnas) * 100}%`,
                top: `${(y / vista.filas) * 100}%`,
                width: `${(w / vista.columnas) * 100}%`,
                height: `${(h / vista.filas) * 100}%`,
                touchAction: "none",
              }}
            >
              <div
                className={`flex h-full w-full flex-col items-center justify-center overflow-hidden border-2 font-bold shadow-sm transition-colors ${
                  m.shape === "redonda" ? "rounded-full" : "rounded-lg"
                } ${
                  !cae
                    ? "border-destructive bg-destructive/20 text-destructive"
                    : elegida
                      ? "border-primary bg-primary/25 text-foreground"
                      : "border-primary/50 bg-card text-foreground"
                } ${m.active ? "" : "opacity-40"}`}
              >
                <span className="text-sm leading-none sm:text-lg">{m.number}</span>
                {w * h > 1 && (
                  <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {m.seats} lug.
                  </span>
                )}
              </div>
              {/* Tirador para estirar: solo en la elegida, para que arrastrar
                  una mesa chica no la estire sin querer. */}
              {elegida && !soloVer && (
                <span
                  aria-label="Estirar la mesa"
                  onPointerDown={(e) => empezar(e, m, "estirar")}
                  {...eventos}
                  className="absolute -bottom-1.5 -right-1.5 z-20 h-5 w-5 cursor-nwse-resize rounded-md border-2 border-background bg-primary shadow"
                  style={{ touchAction: "none" }}
                />
              )}
            </div>
          );
        })}

        {!soloVer && (
          <span
            aria-label="Agrandar o achicar el salón"
            title="Arrastrá para agrandar o achicar el salón"
            onPointerDown={empezarSalon}
            {...eventos}
            className="absolute -bottom-2 -right-2 z-20 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-full border-2 border-background bg-muted-foreground shadow"
            style={{ touchAction: "none" }}
          >
            <MoveDiagonal2 className="h-3 w-3 text-background" />
          </span>
        )}
      </div>
      {arrastre?.modo === "salon" && (
        <p className="mt-2 text-center text-sm font-medium">
          {arrastre.columnas} × {arrastre.filas} cuadros
        </p>
      )}
    </div>
  );
}

/** Un número con botones de menos y más. */
function Paso({
  label,
  valor,
  onMenos,
  onMas,
  puedeMenos,
  puedeMas,
}: {
  label: string;
  valor: number;
  onMenos: () => void;
  onMas: () => void;
  puedeMenos: boolean;
  puedeMas: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label={`${label}: menos`}
        disabled={!puedeMenos}
        onClick={onMenos}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="w-6 text-center font-bold tabular-nums">{valor}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label={`${label}: más`}
        disabled={!puedeMas}
        onClick={onMas}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

/** El costado del editor: los datos de la mesa elegida y su QR. */
function PanelMesa({
  mesa,
  origin,
  soloVer,
  panelClass,
  numerosOcupados,
  onEditar,
  onBorrar,
  onCerrar,
}: {
  mesa: MesaEditor;
  origin: string;
  soloVer: boolean;
  panelClass: string;
  numerosOcupados: number[];
  onEditar: (cambio: Partial<MesaEditor>) => boolean;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  // El número y los lugares se escriben libres y se aplican al salir del campo:
  // aplicar cada tecla rechazaría el "1" de camino a "12".
  const [numero, setNumero] = useState(String(mesa.number));
  const [lugares, setLugares] = useState(String(mesa.seats));
  const [copiado, setCopiado] = useState(false);

  const aplicarNumero = () => {
    const n = Number(numero);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      toast.error("El número de mesa va de 1 a 999");
      setNumero(String(mesa.number));
    } else if (numerosOcupados.includes(n)) {
      toast.error(`Ya hay una mesa ${n}`);
      setNumero(String(mesa.number));
    } else if (n !== mesa.number) {
      onEditar({ number: n });
    }
  };

  const aplicarLugares = () => {
    const n = Number(lugares);
    if (!Number.isInteger(n) || n < LUGARES_MIN || n > LUGARES_MAX) {
      toast.error(`Una mesa tiene entre ${LUGARES_MIN} y ${LUGARES_MAX} lugares`);
      setLugares(String(mesa.seats));
    } else if (n !== mesa.seats && !onEditar({ seats: n })) {
      setLugares(String(mesa.seats));
    }
  };

  const url = mesa.token ? urlDeMesa(origin, mesa.token) : null;

  const copiar = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  const botonBorrar = !soloVer && (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start gap-2 text-destructive hover:text-destructive"
      onClick={onBorrar}
    >
      <Trash2 className="h-4 w-4" />
      Eliminar mesa
    </Button>
  );

  return (
    <div className={`space-y-4 p-5 ${panelClass}`}>
      <div className="flex items-center gap-2">
        <Armchair className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Mesa {mesa.number}</h3>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mesa-numero">Número</Label>
          <Input
            id="mesa-numero"
            inputMode="numeric"
            value={numero}
            disabled={soloVer}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
            onBlur={aplicarNumero}
            onKeyDown={(e) => e.key === "Enter" && aplicarNumero()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mesa-lugares">Lugares</Label>
          <Input
            id="mesa-lugares"
            inputMode="numeric"
            value={lugares}
            disabled={soloVer}
            onChange={(e) => setLugares(e.target.value.replace(/\D/g, ""))}
            onBlur={aplicarLugares}
            onKeyDown={(e) => e.key === "Enter" && aplicarLugares()}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Forma</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(NOMBRE_FORMA) as Forma[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={mesa.shape === f ? "default" : "outline"}
              disabled={soloVer}
              onClick={() => onEditar({ shape: f })}
            >
              {NOMBRE_FORMA[f]}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Ocupa {mesa.w} × {mesa.h} cuadros.
        {!soloVer && " Estirala desde su esquina en el plano; los lugares no cambian."}
      </p>

      <div className="flex items-center gap-3">
        <Switch
          id="mesa-activa"
          checked={mesa.active}
          disabled={soloVer}
          onCheckedChange={(v) => onEditar({ active: v })}
        />
        <Label htmlFor="mesa-activa" className="cursor-pointer">
          {mesa.active ? "Activa: su QR toma pedidos" : "Inactiva: su QR no toma pedidos"}
        </Label>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label>QR de la mesa</Label>
        {url && origin ? (
          // Los botones al costado del QR, para que el panel no se haga largo.
          <div className="flex items-start gap-3">
            <div className="w-fit shrink-0 rounded-xl bg-white p-3">
              <QrConLogo value={url} size={160} marginSize={1} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={copiar}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar link
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir
                </a>
              </Button>
              {botonBorrar}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Guardá el salón para generar su QR.</p>
        )}
      </div>

      {!(url && origin) && botonBorrar}
    </div>
  );
}
