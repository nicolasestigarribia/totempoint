import { useEffect, useState } from "react";
import logo from "@/assets/totem-logo.png";
import wordmark from "@/assets/totem-wordmark.png";
import { leerMarca, type MarcaGuardada } from "@/lib/marca";

/**
 * Pantalla de carga con marca: el isotipo dentro de un anillo que gira sobre un
 * halo que respira, y abajo el logotipo. Reemplaza al spinner pelado de entrada
 * para que el arranque del sistema no se vea crudo.
 *
 * En el panel y la comandera la marca es la de la empresa (la última que se
 * abrió en este navegador, ver `guardarMarca`): el dueño recarga y ve su
 * local, no Totempoint. Con `marca={false}` (superadmin, la portada del sitio)
 * va la de Totempoint.
 */
export function PantallaCarga({ label, marca = true }: { label?: string; marca?: boolean }) {
  // Se lee después de montar: el servidor no sabe qué hay en el navegador, y
  // hasta entonces van solo los anillos, así no salta de un logo al otro.
  const [montada, setMontada] = useState(false);
  const [empresa, setEmpresa] = useState<MarcaGuardada | null>(null);
  useEffect(() => {
    if (marca) setEmpresa(leerMarca());
    setMontada(true);
  }, [marca]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-background">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* Halo del color de la marca, que late suave. */}
        <span className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-2xl" />
        {/* Anillo exterior que gira. */}
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary [animation-duration:900ms]" />
        {/* Anillo interior, más lento y en el acento dorado, en sentido inverso. */}
        <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-gold/70 [animation-direction:reverse] [animation-duration:1400ms]" />
        {montada &&
          (empresa?.logo ? (
            <img
              src={empresa.logo}
              alt=""
              className="h-16 w-16 rounded-full bg-white object-cover shadow-[0_0_18px_var(--primary)]"
            />
          ) : (
            <img
              src={logo}
              alt=""
              className="h-14 w-14 object-contain drop-shadow-[0_0_12px_var(--primary)]"
            />
          ))}
      </div>
      {montada &&
        (empresa ? (
          <p className="font-display text-2xl tracking-tight">{empresa.nombre}</p>
        ) : (
          <img src={wordmark} alt="Totempoint" className="h-6 object-contain opacity-80" />
        ))}
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
