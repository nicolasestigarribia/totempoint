import { useState } from "react";
import { Minus, Plus, Shuffle } from "lucide-react";
import type { TotemComboGrupo } from "@/lib/api/totem.functions";
import type { TotemCartEleccion } from "@/lib/totem-cart";

/**
 * Armar un combo a elección ("18 empanadas clásicas"), dentro de la misma
 * tarjeta del combo. Un contador por gusto y, arriba de cada grupo, cuántos
 * van de cuántos: el botón de agregar se habilita recién cuando están todos.
 * "Repartir el resto" completa lo que falta en partes iguales entre los gustos
 * elegidos (o entre todos, si no eligió ninguno), para el que no quiere contar.
 */
export function ElegirGustos({
  grupos,
  accent,
  onListo,
  onCancelar,
  textoBoton,
}: {
  grupos: TotemComboGrupo[];
  accent: string;
  onListo: (elecciones: TotemCartEleccion[]) => void;
  onCancelar: () => void;
  textoBoton: string;
}) {
  // grupo → productId → cantidad
  const [elegidos, setElegidos] = useState<Record<number, Record<number, number>>>({});

  const delGrupo = (g: number) => elegidos[g] ?? {};
  const suma = (g: number) => Object.values(delGrupo(g)).reduce((t, n) => t + n, 0);
  const completo = grupos.every((g) => suma(g.indice) === g.cantidad);

  const cambiar = (g: number, productId: number, delta: number) =>
    setElegidos((e) => {
      const actual = { ...(e[g] ?? {}) };
      actual[productId] = Math.max(0, (actual[productId] ?? 0) + delta);
      if (actual[productId] === 0) delete actual[productId];
      return { ...e, [g]: actual };
    });

  const repartir = (grupo: TotemComboGrupo) =>
    setElegidos((e) => {
      const actual = { ...(e[grupo.indice] ?? {}) };
      let falta = grupo.cantidad - Object.values(actual).reduce((t, n) => t + n, 0);
      const destino = Object.keys(actual).length
        ? Object.keys(actual).map(Number)
        : grupo.opciones.map((o) => o.id);
      for (let i = 0; falta > 0; i = (i + 1) % destino.length, falta--) {
        actual[destino[i]] = (actual[destino[i]] ?? 0) + 1;
      }
      return { ...e, [grupo.indice]: actual };
    });

  const listo = () =>
    onListo(
      grupos.flatMap((g) =>
        Object.entries(delGrupo(g.indice)).map(([id, quantity]) => ({
          grupo: g.indice,
          productId: Number(id),
          name: g.opciones.find((o) => o.id === Number(id))?.name ?? "",
          quantity,
        })),
      ),
    );

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3">
      {grupos.map((g) => {
        const lleva = suma(g.indice);
        const lleno = lleva >= g.cantidad;
        return (
          <section key={g.indice}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold">
                Elegí {g.cantidad} · {g.nombre}
              </p>
              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${lleno ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {lleva} de {g.cantidad}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(lleva / g.cantidad) * 100}%`, background: accent }}
              />
            </div>
            <ul className="mt-2 divide-y divide-border">
              {g.opciones.map((o) => {
                const n = delGrupo(g.indice)[o.id] ?? 0;
                return (
                  <li key={o.id} className="flex items-center gap-3 py-2">
                    <span className={`min-w-0 flex-1 text-sm ${n > 0 ? "font-bold" : ""}`}>
                      {o.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${o.name}`}
                      disabled={n === 0}
                      onClick={() => cambiar(g.indice, o.id, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold tabular-nums">{n}</span>
                    <button
                      type="button"
                      aria-label={`Agregar ${o.name}`}
                      disabled={lleno}
                      onClick={() => cambiar(g.indice, o.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {!lleno && (
              <button
                type="button"
                onClick={() => repartir(g)}
                className="mt-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Repartir {lleva > 0 ? "el resto" : "parejo"} ({g.cantidad - lleva})
              </button>
            )}
          </section>
        );
      })}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="h-12 rounded-2xl border border-border px-4 font-bold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!completo}
          onClick={listo}
          className="h-12 flex-1 rounded-2xl font-bold text-white transition disabled:opacity-40"
          style={{ background: accent }}
        >
          {completo ? textoBoton : "Elegí todos los gustos"}
        </button>
      </div>
    </div>
  );
}
