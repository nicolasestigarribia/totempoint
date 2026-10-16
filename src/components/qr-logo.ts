import { createContext } from "react";

/**
 * El logo de la empresa que el panel pone en el centro de sus QR (`QrConLogo`).
 * Lo provee `admin.tsx`; fuera del panel vale null y el QR sale liso.
 */
export const LogoQrContext = createContext<string | null>(null);
