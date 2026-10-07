import logo from "@/assets/totem-logo.png";
import wordmark from "@/assets/totem-wordmark.png";

/**
 * Pantalla de carga con marca: el isotipo dentro de un anillo que gira sobre un
 * halo que respira, y abajo el logotipo. Reemplaza al spinner pelado de entrada
 * para que el arranque del sistema no se vea crudo.
 */
export function PantallaCarga({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-background">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* Halo del color de la marca, que late suave. */}
        <span className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-2xl" />
        {/* Anillo exterior que gira. */}
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary [animation-duration:900ms]" />
        {/* Anillo interior, más lento y en el acento dorado, en sentido inverso. */}
        <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-gold/70 [animation-direction:reverse] [animation-duration:1400ms]" />
        <img
          src={logo}
          alt=""
          className="h-14 w-14 object-contain drop-shadow-[0_0_12px_var(--primary)]"
        />
      </div>
      <img src={wordmark} alt="Totempoint" className="h-6 object-contain opacity-80" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
