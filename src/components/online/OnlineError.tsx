import { Clock, RotateCcw, WifiOff } from "lucide-react";
import { esErrorTecnico } from "@/lib/error-message";

/**
 * Lo que ve el cliente cuando el link no puede tomar su pedido. El caso más
 * común es que el local cerró el canal por hoy, y eso no es un error: el
 * título del tótem ("Comercio no disponible") sonaba a que el negocio no
 * existía más.
 */
export function OnlineError({ message }: { message: string }) {
  // Un error técnico (se cortó la conexión con la base, por ejemplo) se
  // arregla solo al rato: se dice eso y se ofrece reintentar, sin mostrar el
  // SQL que falló.
  const tecnico = esErrorTecnico(message);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card/60 p-10 text-center">
        {tecnico ? (
          <WifiOff className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        ) : (
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        )}
        <h1 className="text-2xl font-bold">
          {tecnico ? "Tuvimos un problema para cargar" : "Ahora no podemos tomar tu pedido"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {tecnico
            ? "Puede ser la conexión o algo de nuestro lado. Probá de nuevo en un momento."
            : message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mx-auto mt-6 flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold transition hover:border-primary"
        >
          <RotateCcw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    </div>
  );
}
