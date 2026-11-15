import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, FileText, Loader2, ScanText, X, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { guardarCarta } from "@/lib/api/carta.functions";
import { armarBorrador, faltaEnProducto, type CategoriaBorrador } from "@/lib/carta";
import { interpretarCarta } from "@/lib/carta-texto";
import { mensajeDeError } from "@/lib/error-message";

const MAX_ARCHIVOS = 8;
const MAX_PDF = 20 * 1024 * 1024;

interface Archivo {
  file: File;
  /** Vista previa (solo fotos). */
  url: string | null;
}

/**
 * "Cargar desde la carta": el dueño saca fotos de su carta (o sube el PDF), el
 * navegador lee el texto y arma un borrador, y el dueño lo revisa antes de
 * cargar nada. Es gratis y no sale de su compu hasta que toca "Cargar". Lo que
 * ya existe en el catálogo viene destildado para no duplicarlo.
 */
export function ImportarCartaDialog({
  open,
  onOpenChange,
  onCargado,
  categorias,
  productos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCargado: () => void;
  /** El catálogo actual, para no duplicar categorías ni productos. */
  categorias: { id: number; name: string }[];
  productos: string[];
}) {
  const guardar = useServerFn(guardarCarta);
  const inputRef = useRef<HTMLInputElement>(null);

  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [progreso, setProgreso] = useState<{ mensaje: string; fraccion: number }>({
    mensaje: "",
    fraccion: 0,
  });
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<CategoriaBorrador[] | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  function reiniciar() {
    archivos.forEach((a) => a.url && URL.revokeObjectURL(a.url));
    setArchivos([]);
    setBorrador(null);
    setAvisos([]);
  }

  function cerrar(v: boolean) {
    if (leyendo || guardando) return;
    if (!v) reiniciar();
    onOpenChange(v);
  }

  async function agregar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPreparando(true);
    try {
      const nuevos: Archivo[] = [];
      for (const f of Array.from(files)) {
        if (archivos.length + nuevos.length >= MAX_ARCHIVOS) {
          toast.error(`Como mucho ${MAX_ARCHIVOS} archivos por vez`);
          break;
        }
        // Algunos celulares (y archivos que vienen de Drive o WhatsApp) llegan
        // sin tipo: se reconocen por la extensión.
        if (f.type === "application/pdf" || (!f.type && /\.pdf$/i.test(f.name))) {
          if (f.size > MAX_PDF) {
            toast.error(`${f.name} pesa más de 20 MB`);
            continue;
          }
          nuevos.push({ file: f, url: null });
        } else if (
          f.type.startsWith("image/") ||
          (!f.type && /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name))
        ) {
          nuevos.push({ file: f, url: URL.createObjectURL(f) });
        } else {
          toast.error(`${f.name} no es una foto ni un PDF`);
        }
      }
      setArchivos((a) => [...a, ...nuevos]);
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo preparar el archivo"));
    } finally {
      setPreparando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function leerArchivos() {
    // Sin archivos el botón no se apaga: avisa y abre el selector, para que
    // nunca parezca que no hace nada.
    if (archivos.length === 0) {
      toast.info("Primero elegí una foto o el PDF de tu carta");
      inputRef.current?.click();
      return;
    }
    setLeyendo(true);
    setProgreso({ mensaje: "Preparando…", fraccion: 0 });
    try {
      // Se carga recién acá: el lector pesa y solo lo usa quien lee una carta.
      const { textoDeArchivos } = await import("@/lib/leer-carta-navegador");
      const texto = await textoDeArchivos(
        archivos.map((a) => a.file),
        (mensaje, fraccion) => setProgreso({ mensaje, fraccion }),
      );
      const { carta, noEntendidas } = interpretarCarta(texto);
      const b = armarBorrador(carta, { categorias, productos });
      if (b.length === 0) {
        toast.error(
          "No encontramos productos con precio. Probá con una foto más nítida, de frente y con buena luz.",
        );
        return;
      }
      setBorrador(b);
      setAvisos(noEntendidas.slice(0, 40));
    } catch (err) {
      console.error("[carta] Error leyendo:", err);
      toast.error(mensajeDeError(err, "No pudimos leer la carta"));
    } finally {
      setLeyendo(false);
    }
  }

  function agregarProducto(ci: number) {
    setBorrador(
      (b) =>
        b &&
        b.map((c, i) =>
          i !== ci
            ? c
            : {
                ...c,
                productos: [
                  ...c.productos,
                  {
                    nombre: "",
                    descripcion: null,
                    precio: null,
                    tamanios: [],
                    yaExiste: false,
                    incluir: true,
                  },
                ],
              },
        ),
    );
  }

  function editarCategoria(ci: number, nombre: string) {
    setBorrador((b) => b && b.map((c, i) => (i === ci ? { ...c, nombre } : c)));
  }

  function editarProducto(
    ci: number,
    pi: number,
    cambio: Partial<CategoriaBorrador["productos"][number]>,
  ) {
    setBorrador(
      (b) =>
        b &&
        b.map((c, i) =>
          i !== ci
            ? c
            : { ...c, productos: c.productos.map((p, j) => (j === pi ? { ...p, ...cambio } : p)) },
        ),
    );
  }

  function tildarCategoria(ci: number, incluir: boolean) {
    setBorrador(
      (b) =>
        b &&
        b.map((c, i) =>
          i !== ci ? c : { ...c, productos: c.productos.map((p) => ({ ...p, incluir })) },
        ),
    );
  }

  const elegidos = borrador?.flatMap((c) => c.productos.filter((p) => p.incluir)) ?? [];
  const conFaltas = elegidos.filter((p) => faltaEnProducto(p) != null).length;

  async function cargar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      const categorias = borrador
        .map((c) => ({
          nombre: c.nombre.trim() || "Otros",
          existenteId: c.existenteId,
          productos: c.productos
            .filter((p) => p.incluir)
            .map((p) => ({
              nombre: p.nombre.trim(),
              descripcion: p.descripcion?.trim() || null,
              precio: p.tamanios.length > 0 ? null : p.precio,
              tamanios: p.tamanios,
            })),
        }))
        .filter((c) => c.productos.length > 0);
      const r = await guardar({ data: { categorias } });
      toast.success(
        `Listo: cargaste ${r.productos} productos` +
          (r.categorias > 0 ? ` y ${r.categorias} categorías nuevas` : "") +
          ". Ahora podés sumarles fotos.",
      );
      reiniciar();
      onOpenChange(false);
      onCargado();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudieron cargar los productos"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="h-5 w-5 text-primary" />
            Cargar el menú desde tu carta
          </DialogTitle>
        </DialogHeader>

        {!borrador && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sacale fotos a tu carta (una por página, de frente y con buena luz) o subí el PDF.
              Leemos los productos y precios, y antes de cargar nada te los mostramos para que los
              revises.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => agregar(e.target.files)}
            />

            {archivos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {archivos.map((a, i) => (
                  <div
                    key={i}
                    className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted"
                  >
                    {a.url ? (
                      <img src={a.url} alt={a.file.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span className="line-clamp-2 break-all">{a.file.name}</span>
                      </div>
                    )}
                    {!leyendo && (
                      <button
                        type="button"
                        aria-label="Quitar"
                        onClick={() => setArchivos((x) => x.filter((_, j) => j !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {leyendo ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium">{progreso.mensaje || "Leyendo tu carta…"}</p>
                <Progress
                  value={Math.round(progreso.fraccion * 100)}
                  className="h-2 w-full max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Puede tardar unos segundos por foto. No cierres esta ventana.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={preparando || archivos.length >= MAX_ARCHIVOS}
                  onClick={() => inputRef.current?.click()}
                >
                  {preparando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {archivos.length === 0 ? "Elegir fotos o PDF" : "Agregar otra página"}
                </Button>
                <Button className="gap-2" disabled={preparando} onClick={leerArchivos}>
                  <ScanText className="h-4 w-4" />
                  Leer la carta
                </Button>
              </div>
            )}
          </div>
        )}

        {borrador && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Revisá lo que leímos: la lectura es automática y se puede equivocar en una letra o un
              precio. Corregí lo que haga falta, sumá lo que se haya escapado y destildá lo que no
              quieras cargar. Lo que ya tenés cargado viene destildado.
            </p>

            {avisos.length > 0 && (
              <details className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <summary className="flex cursor-pointer items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {avisos.length === 1
                    ? "1 renglón que no entendimos"
                    : `${avisos.length} renglones que no entendimos`}
                  <span className="font-normal text-muted-foreground">(tocá para verlos)</span>
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Si alguno es un producto, sumalo con “Agregar producto” en su categoría.
                </p>
                <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            )}

            {borrador.map((c, ci) => {
              const todos = c.productos.every((p) => p.incluir);
              return (
                <div key={ci} className="rounded-xl border">
                  <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2">
                    <Checkbox
                      checked={todos}
                      onCheckedChange={(v) => tildarCategoria(ci, v === true)}
                      aria-label="Tildar toda la categoría"
                    />
                    <Input
                      value={c.nombre}
                      onChange={(e) => editarCategoria(ci, e.target.value)}
                      disabled={c.existenteId != null}
                      className="h-9 max-w-xs font-semibold"
                    />
                    <span className="text-xs text-muted-foreground">
                      {c.existenteId != null ? "Ya la tenés" : "Categoría nueva"}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {c.productos.map((p, pi) => {
                      const falta = p.incluir ? faltaEnProducto(p) : null;
                      return (
                        <li
                          key={pi}
                          className={`flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start ${p.incluir ? "" : "opacity-50"}`}
                        >
                          <Checkbox
                            className="mt-2.5"
                            checked={p.incluir}
                            onCheckedChange={(v) => editarProducto(ci, pi, { incluir: v === true })}
                            aria-label={`Cargar ${p.nombre}`}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <Input
                              value={p.nombre}
                              onChange={(e) => editarProducto(ci, pi, { nombre: e.target.value })}
                              className="h-9"
                            />
                            <Input
                              value={p.descripcion ?? ""}
                              placeholder="Descripción (opcional)"
                              onChange={(e) =>
                                editarProducto(ci, pi, { descripcion: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                            {p.yaExiste && (
                              <p className="text-xs text-amber-600">
                                Ya tenés un producto con este nombre
                              </p>
                            )}
                            {falta && <p className="text-xs text-red-500">{falta}</p>}
                          </div>
                          <div className="sm:w-44">
                            {p.tamanios.length > 0 ? (
                              <ul className="space-y-1 text-sm">
                                {p.tamanios.map((t, ti) => (
                                  <li key={ti} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">{t.nombre}</span>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      value={t.precio}
                                      onChange={(e) =>
                                        editarProducto(ci, pi, {
                                          tamanios: p.tamanios.map((x, k) =>
                                            k === ti
                                              ? { ...x, precio: Number(e.target.value) || 0 }
                                              : x,
                                          ),
                                        })
                                      }
                                      className="h-8 w-24 text-right"
                                    />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  value={p.precio ?? ""}
                                  placeholder="Precio"
                                  onChange={(e) =>
                                    editarProducto(ci, pi, {
                                      precio: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="h-9 text-right"
                                />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => agregarProducto(ci)}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary hover:bg-muted/40"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </button>
                </div>
              );
            })}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background px-6 py-4">
              <div className="text-sm">
                <span className="font-semibold">{elegidos.length} productos tildados</span>
                {conFaltas > 0 && <span className="text-red-500"> · {conFaltas} sin precio</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={guardando} onClick={reiniciar}>
                  Empezar de nuevo
                </Button>
                <Button
                  disabled={guardando || elegidos.length === 0 || conFaltas > 0}
                  onClick={cargar}
                  className="gap-2"
                >
                  {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cargar {elegidos.length} productos
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
