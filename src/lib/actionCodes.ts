export type MovementType = "stock" | "caja";
export type MovementDirection = "ingreso" | "egreso";

export interface ActionCode {
  code: string;
  label: string;
  type: MovementType;
  direction: MovementDirection;
  auto: boolean; // generado por el sistema (ej: ventas) — no se carga a mano
}

export function actionLabel(codes: ActionCode[], code: string): string {
  return codes.find((c) => c.code === code)?.label ?? code;
}

export function getActionCode(codes: ActionCode[], code: string): ActionCode | undefined {
  return codes.find((c) => c.code === code);
}

// Códigos usables a mano (excluye los automáticos). Filtra por tipo y opcionalmente dirección.
export function manualCodes(
  codes: ActionCode[],
  type: MovementType,
  direction?: MovementDirection,
): ActionCode[] {
  return codes.filter(
    (c) => c.type === type && !c.auto && (direction ? c.direction === direction : true),
  );
}
