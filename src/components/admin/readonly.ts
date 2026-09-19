import { createContext, useContext } from "react";

/**
 * Si la sección abierta es de solo lectura para quien la está mirando.
 *
 * El servidor ya rechaza cualquier escritura sin permiso de edición, pero eso
 * el usuario lo descubre recién cuando aprieta Guardar y le salta un error. El
 * panel avisa con un cartel arriba; esto es lo que deja que cada sección se
 * acomode y directamente no muestre lo que no va a poder hacer: el botón de
 * crear, la columna de acciones, los interruptores de estado.
 *
 * Lo que sí queda es todo lo de mirar —buscar, filtrar, ordenar, paginar—,
 * que es justamente para lo que le dieron la sección.
 *
 * Fuera del panel, y para el dueño y el superadmin, vale false y las secciones
 * se comportan como siempre.
 */
export const ReadOnlyContext = createContext(false);

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
