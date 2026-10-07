import { describe, expect, test } from "bun:test";
import { estadoHorario, type Horarios } from "./horario";

// Hora argentina (UTC-3): "2026-10-05T19:30:00-03:00" es lunes 19:30.
const en = (iso: string) => new Date(iso);

const semana = (turnos: { desde: string; hasta: string }[]): Horarios =>
  Array.from({ length: 7 }, () => turnos);

describe("horario del pedido online", () => {
  test("sin horario cargado está siempre abierto", () => {
    expect(estadoHorario(null)).toEqual({ abierto: true, texto: null });
    expect(estadoHorario([[], [], [], [], [], [], []])).toEqual({ abierto: true, texto: null });
  });

  test("dentro de un turno, abierto y hasta cuándo", () => {
    const h = semana([
      { desde: "11:00", hasta: "15:00" },
      { desde: "19:00", hasta: "23:30" },
    ]);
    expect(estadoHorario(h, en("2026-10-05T20:00:00-03:00"))).toEqual({
      abierto: true,
      texto: "hasta las 23:30",
    });
  });

  test("entre turnos, cerrado y abre hoy", () => {
    const h = semana([
      { desde: "11:00", hasta: "15:00" },
      { desde: "19:00", hasta: "23:30" },
    ]);
    expect(estadoHorario(h, en("2026-10-05T16:00:00-03:00"))).toEqual({
      abierto: false,
      texto: "hoy a las 19:00",
    });
  });

  test("después del último turno, abre mañana", () => {
    const h = semana([{ desde: "11:00", hasta: "15:00" }]);
    expect(estadoHorario(h, en("2026-10-05T22:00:00-03:00"))).toEqual({
      abierto: false,
      texto: "mañana a las 11:00",
    });
  });

  test("un turno que cruza la medianoche sigue abierto de madrugada", () => {
    const h: Horarios = [[], [], [], [], [], [{ desde: "20:00", hasta: "02:00" }], []];
    // Sábado 10/10 a la 1:00: es el turno del viernes.
    expect(estadoHorario(h, en("2026-10-10T01:00:00-03:00"))).toEqual({
      abierto: true,
      texto: "hasta las 02:00",
    });
    // Sábado 3:00: cerrado hasta el viernes que viene.
    expect(estadoHorario(h, en("2026-10-10T03:00:00-03:00"))).toEqual({
      abierto: false,
      texto: "el viernes a las 20:00",
    });
  });

  test("el sábado que cruza al domingo", () => {
    const h: Horarios = [[], [], [], [], [], [], [{ desde: "21:00", hasta: "01:00" }]];
    expect(estadoHorario(h, en("2026-10-11T00:30:00-03:00")).abierto).toBe(true);
  });

  test("día sin turnos, abre el próximo con turno", () => {
    const h: Horarios = [[], [{ desde: "11:00", hasta: "15:00" }], [], [], [], [], []];
    // Martes 6/10 12:00 → el lunes que viene.
    expect(estadoHorario(h, en("2026-10-06T12:00:00-03:00"))).toEqual({
      abierto: false,
      texto: "el lunes a las 11:00",
    });
  });

  test("usa la hora argentina, no la del servidor", () => {
    const h = semana([{ desde: "19:00", hasta: "23:00" }]);
    // 23:30 UTC del lunes son las 20:30 en Argentina: abierto.
    expect(estadoHorario(h, en("2026-10-05T23:30:00Z")).abierto).toBe(true);
  });
});
