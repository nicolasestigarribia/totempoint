/**
 * Pizza mitad y mitad, dentro de la misma tarjeta: un botón discreto debajo
 * del tamaño, y al tocarlo, la lista de gustos para la otra mitad. Quien pide
 * una pizza entera no lo nota: el botón de agregar sigue donde estaba.
 */
export function ElegirMitad({
  opciones,
  elegida,
  onElegir,
  accent,
  grande = false,
}: {
  opciones: { id: number; name: string }[];
  /** Id de la otra mitad, o null si va entera. */
  elegida: number | null;
  onElegir: (id: number | null) => void;
  accent: string;
  /** Tamaño del tótem, que se toca con el dedo de lejos. */
  grande?: boolean;
}) {
  if (opciones.length === 0) return null;
  const activa = elegida !== null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${grande ? "text-base" : "text-xs"}`}>
      <button
        type="button"
        aria-pressed={activa}
        onClick={() => onElegir(activa ? null : opciones[0].id)}
        className={`rounded-full border font-bold transition ${grande ? "px-4 py-2" : "px-3 py-1"} ${
          activa ? "text-white" : "border-border text-muted-foreground"
        }`}
        style={activa ? { background: accent, borderColor: accent } : undefined}
      >
        ½ Mitad y mitad
      </button>
      {activa && (
        <label className="flex min-w-0 items-center gap-1.5 font-bold">
          <span className="shrink-0 text-muted-foreground">con</span>
          <select
            value={elegida}
            onChange={(e) => onElegir(Number(e.target.value))}
            aria-label="Gusto de la otra mitad"
            className={`min-w-0 max-w-full rounded-full border bg-background font-bold ${grande ? "h-11 px-4" : "h-7 px-2"}`}
            style={{ borderColor: accent }}
          >
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
