import { Clock } from "lucide-react";

/**
 * Lo que ve el cliente cuando el link no puede tomar su pedido. El caso más
 * común es que el local cerró el canal por hoy, y eso no es un error: el
 * título del tótem ("Comercio no disponible") sonaba a que el negocio no
 * existía más.
 */
export function OnlineError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card/60 p-10 text-center">
        <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Ahora no podemos tomar tu pedido</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
