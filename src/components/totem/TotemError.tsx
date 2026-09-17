import { Store } from "lucide-react";

export function TotemError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card/60 p-10 text-center">
        <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Comercio no disponible</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
