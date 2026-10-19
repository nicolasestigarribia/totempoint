/**
 * Una planilla CSV que Excel abre bien en una computadora en castellano: con
 * punto y coma entre columnas (con coma, el Excel argentino pone todo en una
 * sola celda), BOM para que respete los acentos y montos sin separador de
 * miles para que los pueda sumar.
 */
const BOM = String.fromCharCode(0xfeff);

export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    if (v === null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    // Comillas si hace falta, y nada que Excel lea como fórmula.
    const seguro = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s;
    return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return BOM + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}

/** Descarga un texto como archivo, en el navegador. */
export function descargarArchivo(
  nombre: string,
  contenido: string,
  tipo = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
