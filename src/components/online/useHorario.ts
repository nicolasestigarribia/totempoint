import { useEffect, useState } from "react";
import { estadoHorario, type EstadoHorario, type Horarios } from "@/lib/horario";

/**
 * Si la sucursal está abierta ahora, recalculado cada medio minuto: el
 * cliente puede dejar el menú abierto mientras cierran (o mientras abren) y la
 * pantalla tiene que enterarse sin recargar. El que decide igual es el
 * servidor al recibir el pedido.
 */
export function useHorario(horarios: Horarios | null): EstadoHorario {
  const [estado, setEstado] = useState(() => estadoHorario(horarios));
  useEffect(() => {
    setEstado(estadoHorario(horarios));
    const id = setInterval(() => setEstado(estadoHorario(horarios)), 30_000);
    return () => clearInterval(id);
  }, [horarios]);
  return estado;
}
