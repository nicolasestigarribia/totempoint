import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Precarga el chunk y el loader de la pantalla destino al apoyar el dedo
    // (touchstart/pointerenter), así llega lista al soltar y el tótem se siente
    // fluido. El costo en pedidos lo absorbe el cache de 60s del menú.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
