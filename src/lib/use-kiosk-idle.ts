import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKioskCart } from "@/lib/kiosk-cart";

const IDLE_MS = 90_000;

// Si un cliente se va a mitad del pedido, la tablet no puede quedar con su
// carrito abierto para el siguiente. Pasado el tiempo sin tocar la pantalla,
// vuelve sola a la portada y vacía el pedido.
export function useKioskIdleReset(slug: string) {
  const navigate = useNavigate();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        useKioskCart.getState().clear();
        navigate({ to: "/k/$slug", params: { slug }, replace: true });
      }, IDLE_MS);
    };

    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [navigate, slug]);
}
