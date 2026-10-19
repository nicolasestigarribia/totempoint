import { describe, expect, test } from "bun:test";
import { jornadaDe } from "./jornada";

// Las horas van en UTC, como las ve el servidor; Argentina es UTC-3.
describe("jornadaDe", () => {
  test("a la noche sigue siendo hoy, aunque en UTC ya sea mañana", () => {
    // 22:30 del 19 en Argentina = 01:30 del 20 en UTC.
    expect(jornadaDe(new Date("2026-10-20T01:30:00Z"))).toBe("2026-10-19");
  });

  test("pasada la medianoche sigue en la jornada de la noche", () => {
    // 00:30 y 05:59 del 20 en Argentina.
    expect(jornadaDe(new Date("2026-10-20T03:30:00Z"))).toBe("2026-10-19");
    expect(jornadaDe(new Date("2026-10-20T08:59:00Z"))).toBe("2026-10-19");
  });

  test("a las 6 de la mañana arranca la jornada nueva", () => {
    expect(jornadaDe(new Date("2026-10-20T09:00:00Z"))).toBe("2026-10-20");
    expect(jornadaDe(new Date("2026-10-20T15:00:00Z"))).toBe("2026-10-20");
  });

  test("cambio de mes y de año", () => {
    expect(jornadaDe(new Date("2027-01-01T04:00:00Z"))).toBe("2026-12-31");
  });
});
