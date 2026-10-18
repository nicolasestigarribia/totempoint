import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

export interface HerramientaAvanzada {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** El tema bajo el que se agrupa en la página. */
  tema: string;
}

/**
 * Todo lo que no hace falta para vender, en una sola página: el menú del panel
 * queda con lo necesario y esto está a un toque para quien lo usa (stock,
 * recetas, varias sucursales, equipo, registros). Cada tarjeta abre su sección,
 * que vuelve acá con el botón de atrás.
 */
export function AvanzadoSection({
  herramientas,
  panelClass,
  onIr,
}: {
  herramientas: HerramientaAvanzada[];
  panelClass: string;
  onIr: (id: string) => void;
}) {
  const temas = [...new Set(herramientas.map((h) => h.tema))];
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Nada de esto hace falta para empezar a vender. Usalo cuando lo necesites: si querés
        controlar el stock, tenés más de una sucursal o sumás gente a trabajar con vos.
      </p>
      {temas.map((tema) => (
        <section key={tema} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {tema}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {herramientas
              .filter((h) => h.tema === tema)
              .map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onIr(h.id)}
                  className={`group flex items-start gap-4 p-5 text-left transition hover:border-primary ${panelClass}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <h.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{h.label}</span>
                    <span className="block text-sm text-muted-foreground">{h.desc}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
