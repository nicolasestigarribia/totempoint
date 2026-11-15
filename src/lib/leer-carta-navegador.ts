/**
 * Saca el texto de la carta en el navegador del dueño, gratis y sin cuentas:
 * - foto → reconocimiento de texto con Tesseract.js (corre en la página; la
 *   primera vez baja el idioma español, unos MB que después quedan guardados);
 * - PDF → el texto que trae adentro, con pdf.js. Si una página es una imagen
 *   escaneada (no trae texto), se dibuja y se lee como una foto.
 *
 * Las librerías se cargan solo cuando alguien lee una carta, así no pesan en el
 * resto del panel. Lo que devuelve es texto plano que interpreta `interpretarCarta`.
 */
import { compress } from "@/components/admin/ImageUploadField";

export type Progreso = (mensaje: string, fraccion: number) => void;

/** Lado máximo para leer una foto: suficiente para la letra chica, sin tardar de más. */
const LADO_LECTURA = 2400;

type WorkerOcr = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

async function crearOcr(progreso: (f: number) => void): Promise<WorkerOcr> {
  const { createWorker } = await import("tesseract.js");
  return createWorker("spa", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") progreso(m.progress);
    },
  });
}

/** Une los pedazos de texto de una página de PDF en renglones, de arriba abajo. */
function renglonesDePdf(items: { str: string; transform: number[]; width: number }[]): string {
  const filas: { y: number; partes: { x: number; fin: number; str: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let fila = filas.find((f) => Math.abs(f.y - y) < 3);
    if (!fila) {
      fila = { y, partes: [] };
      filas.push(fila);
    }
    fila.partes.push({ x, fin: x + it.width, str: it.str });
  }
  filas.sort((a, b) => b.y - a.y);
  return filas
    .map((f) => {
      f.partes.sort((a, b) => a.x - b.x);
      let linea = "";
      let fin = -Infinity;
      for (const p of f.partes) {
        // Un hueco grande entre pedazos separa nombre y precio: dejamos espacios.
        linea += (linea && p.x - fin > 4 ? "   " : "") + p.str;
        fin = p.fin;
      }
      return linea;
    })
    .join("\n");
}

async function textoDePdf(
  archivo: File,
  leerImagen: (src: string, avance: (f: number) => void) => Promise<string>,
  avisar: (mensaje: string, f: number) => void,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const doc = await tarea.promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    avisar(`Leyendo la página ${n} de ${doc.numPages} del PDF`, (n - 1) / doc.numPages);
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const texto = renglonesDePdf(
      contenido.items.filter(
        (
          i,
        ): i is (typeof contenido.items)[number] & {
          str: string;
          transform: number[];
          width: number;
        } => "str" in i,
      ),
    );
    if (texto.replace(/[^a-záéíóúñ]/gi, "").length >= 20) {
      paginas.push(texto);
      continue;
    }
    // Página escaneada: se dibuja y se lee como foto.
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pagina.render({ canvas, viewport }).promise;
    paginas.push(
      await leerImagen(canvas.toDataURL("image/png"), (f) =>
        avisar(`Leyendo la página ${n} de ${doc.numPages} del PDF`, (n - 1 + f) / doc.numPages),
      ),
    );
  }
  await tarea.destroy();
  return paginas.join("\n");
}

export async function textoDeArchivos(archivos: File[], progreso: Progreso): Promise<string> {
  let ocr: WorkerOcr | null = null;
  let avanceOcr: (f: number) => void = () => {};
  const leerImagen = async (src: string, avance: (f: number) => void) => {
    if (!ocr) {
      progreso("Preparando el lector (la primera vez tarda un poco más)", 0);
      ocr = await crearOcr((f) => avanceOcr(f));
    }
    avanceOcr = avance;
    const { data } = await ocr.recognize(src);
    return data.text;
  };

  try {
    const textos: string[] = [];
    for (let i = 0; i < archivos.length; i++) {
      const a = archivos[i];
      const base = i / archivos.length;
      const parte = 1 / archivos.length;
      const avisar = (mensaje: string, f: number) => progreso(mensaje, base + f * parte);
      if (a.type === "application/pdf") {
        textos.push(await textoDePdf(a, leerImagen, avisar));
      } else {
        const etiqueta =
          archivos.length > 1
            ? `Leyendo la foto ${i + 1} de ${archivos.length}`
            : "Leyendo la foto";
        avisar(etiqueta, 0);
        let foto: Awaited<ReturnType<typeof compress>>;
        try {
          foto = await compress(a, LADO_LECTURA);
        } catch {
          // Típico: una foto de iPhone en HEIC abierta desde Chrome en la compu.
          throw new Error(
            `No pudimos abrir ${a.name}. Probá sacándole una captura de pantalla o guardándola como JPG.`,
          );
        }
        const { mimeType, data } = foto;
        textos.push(
          await leerImagen(`data:${mimeType};base64,${data}`, (f) => avisar(etiqueta, f)),
        );
      }
    }
    progreso("Armando tu menú", 1);
    return textos.join("\n");
  } finally {
    if (ocr) await (ocr as WorkerOcr).terminate();
  }
}
