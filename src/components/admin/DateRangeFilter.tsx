import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { es } from "react-day-picker/locale";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "YYYY-MM-DD" de un día local, sin pasar por UTC. */
export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function hoyIso(): string {
  return isoDia(new Date());
}

function desdeIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mostrar(s: string): string {
  return desdeIso(s).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDia(d);
}

const ATAJOS: { label: string; rango: () => [string, string] }[] = [
  { label: "Hoy", rango: () => [hoyIso(), hoyIso()] },
  { label: "Ayer", rango: () => [haceDias(1), haceDias(1)] },
  { label: "7 días", rango: () => [haceDias(6), hoyIso()] },
  {
    label: "Este mes",
    rango: () => {
      const d = new Date();
      return [isoDia(new Date(d.getFullYear(), d.getMonth(), 1)), hoyIso()];
    },
  },
];

/**
 * Un día, con su calendario.
 *
 * Reemplaza al `<input type="date">` nativo, que en Chrome sólo abre el
 * calendario si se toca justo el iconito: tocando la fecha a veces se abría y
 * a veces no, según dónde cayera el dedo. Acá todo el botón abre el calendario.
 */
function DiaPicker({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const deshabilitados = [
    ...(min ? [{ before: desdeIso(min) }] : []),
    ...(max ? [{ after: desdeIso(max) }] : []),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 min-w-40 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="font-semibold">{mostrar(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          locale={es}
          selected={desdeIso(value)}
          defaultMonth={desdeIso(value)}
          disabled={deshabilitados}
          onSelect={(d) => {
            if (!d) return;
            onChange(isoDia(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Rango de fechas "desde / hasta" con atajos.
 *
 * Nunca deja un rango invertido: si "desde" pasa a ser posterior a "hasta", el
 * otro extremo se corre para acompañarlo, en vez de mostrar un error.
 */
export function DateRangeFilter({
  desde,
  hasta,
  onChange,
  max = hoyIso(),
}: {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  max?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {ATAJOS.map((a) => {
          const [d, h] = a.rango();
          const activo = d === desde && h === hasta;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => onChange(d, h)}
              className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${
                activo
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
      <DiaPicker
        label="Desde"
        value={desde}
        max={max}
        onChange={(v) => onChange(v, v > hasta ? v : hasta)}
      />
      <DiaPicker
        label="Hasta"
        value={hasta}
        max={max}
        onChange={(v) => onChange(v < desde ? v : desde, v)}
      />
    </div>
  );
}
