/**
 * Imprime un documento HTML con la impresora del sistema, desde un iframe
 * aparte: la comandera sigue en pantalla y no se imprime ella misma.
 *
 * Sin configuración, Chrome muestra su cartel de impresión. Abierto con
 * `--kiosk-printing` imprime directo en la impresora predeterminada, que es
 * lo que se quiere en la cocina.
 */
export function imprimirHtml(html: string): void {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  // Fuera de la pantalla pero con tamaño: un iframe de 0×0 o con display:none
  // en algunos navegadores imprime una hoja en blanco.
  Object.assign(marco.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "80mm",
    height: "200mm",
    border: "0",
  });
  marco.srcdoc = html;
  marco.onload = () => {
    const w = marco.contentWindow;
    if (!w) return;
    const quitar = () => setTimeout(() => marco.remove(), 1000);
    w.addEventListener("afterprint", quitar, { once: true });
    // Si el navegador nunca avisa que terminó, igual se limpia.
    setTimeout(() => marco.remove(), 120_000);
    w.focus();
    w.print();
  };
  document.body.appendChild(marco);
}
