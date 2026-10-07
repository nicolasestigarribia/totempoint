/**
 * El horario del pedido online de una sucursal.
 *
 * Cada día de la semana tiene cero, uno o más turnos ("11:00 a 15:00" y
 * "19:00 a 23:30"). Un turno que termina antes de empezar cruza la
 * medianoche: "20:00 a 02:00" del viernes sigue abierto el sábado a la 1.
 * Sin horario cargado, la sucursal toma pedidos siempre que el canal esté
 * encendido, como hasta ahora.
 *
 * Todo se calcula en hora argentina, no en la del servidor (Railway corre en
 * UTC) ni en la del celular (un turista con el teléfono en otra zona).
 *
 * Vive sin base de datos porque lo usan el servidor, que rechaza pedidos fuera
 * de hora, y el celular, que muestra si está abierto y cuándo abre.
 */

export const ZONA = "America/Argentina/Buenos_Aires";

/** Un turno: "HH:MM" a "HH:MM". */
export interface Turno {
  desde: string;
  hasta: string;
}

/** Turnos por día: índice 0 = domingo … 6 = sábado, como `Date.getDay()`. */
export type Horarios = Turno[][];

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const horaValida = (h: string) => HORA.test(h);

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Día de la semana y minuto del día, en hora argentina. */
export function ahoraEnArgentina(fecha = new Date()): { dia: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(valor("weekday"));
  return { dia, minuto: Number(valor("hour")) * 60 + Number(valor("minute")) };
}

/** Si hay algún turno cargado. Sin ninguno, no hay restricción de horario. */
export const tieneHorario = (h: Horarios | null | undefined): h is Horarios =>
  !!h && h.some((d) => d.length > 0);

/**
 * Los intervalos de la semana en minutos desde el domingo 00:00, con los que
 * cruzan la medianoche partidos en dos (y el del sábado que cruza, pasado al
 * domingo).
 */
function intervalos(h: Horarios): [number, number][] {
  const SEMANA = 7 * 24 * 60;
  const lista: [number, number][] = [];
  h.forEach((turnos, dia) => {
    for (const t of turnos) {
      if (!horaValida(t.desde) || !horaValida(t.hasta)) continue;
      const ini = dia * 24 * 60 + minutos(t.desde);
      let fin = dia * 24 * 60 + minutos(t.hasta);
      if (fin <= ini) fin += 24 * 60;
      if (fin <= SEMANA) lista.push([ini, fin]);
      else lista.push([ini, SEMANA], [0, fin - SEMANA]);
    }
  });
  return lista;
}

export interface EstadoHorario {
  abierto: boolean;
  /** Abierto: "hasta las 23:30". Cerrado: "hoy a las 19:00", "mañana a las 11:00", "el lunes a las 11:00". */
  texto: string | null;
}

const hhmm = (min: number) =>
  `${String(Math.floor((min % 1440) / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function estadoHorario(h: Horarios | null | undefined, fecha = new Date()): EstadoHorario {
  if (!tieneHorario(h)) return { abierto: true, texto: null };
  const { dia, minuto } = ahoraEnArgentina(fecha);
  const ahora = dia * 1440 + minuto;
  const lista = intervalos(h);

  const actual = lista.find(([ini, fin]) => ahora >= ini && ahora < fin);
  if (actual) {
    // Si el turno sigue en otro tramo pegado (cruzó el fin de semana), cierra
    // al final del siguiente.
    let fin = actual[1];
    const pegado = lista.find(([ini]) => ini === fin % (7 * 1440) && fin === 7 * 1440);
    if (pegado) fin = pegado[1];
    return { abierto: true, texto: `hasta las ${hhmm(fin)}` };
  }

  // El próximo inicio, mirando hacia adelante en la semana (y dando la vuelta).
  const inicios = lista.map(([ini]) => (ini > ahora ? ini - ahora : ini + 7 * 1440 - ahora));
  const espera = Math.min(...inicios);
  const abre = ahora + espera;
  const diaAbre = Math.floor(abre / 1440) % 7;
  const diasHasta = Math.floor(abre / 1440) - dia;
  const cuando = diasHasta === 0 ? "hoy" : diasHasta === 1 ? "mañana" : `el ${DIAS[diaAbre]}`;
  return { abierto: false, texto: `${cuando} a las ${hhmm(abre)}` };
}
