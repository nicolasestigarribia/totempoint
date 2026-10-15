import type { PortadaDatos } from "@/lib/api/totem.functions";
import { TotemMotas } from "@/components/totem/TotemMotas";
import {
  Badges,
  ContenidoBoton,
  FotosPortada,
  Logo,
  Title,
  acentoDe,
  claseBoton,
  fotosDe,
  estiloBoton,
} from "@/components/totem/portada-partes";

/** La pastilla sobre la foto: "Abierto · hasta las 20:00". */
export interface EstadoPortada {
  abierto: boolean;
  texto: string;
}

/**
 * La portada del tótem en el teléfono, para el pedido online y el de mesa:
 * la foto arriba, la marca y el título en el medio, y el botón al pie, donde
 * llega el pulgar. Los textos y la foto son los de la sección Portada del
 * panel, así que la marca se ve igual en la tablet y en el celular.
 *
 * No sabe de rutas: cada canal decide qué pasa al tocar Pedir. Sin
 * `onPedir` es la vista previa del panel, que se ve igual y no hace nada.
 */
export function PortadaCelular({
  datos,
  estado,
  chips,
  aviso,
  onPedir,
  onSoloVer,
}: {
  datos: PortadaDatos;
  estado?: EstadoPortada | null;
  chips?: string[];
  /** Lo que el canal pone arriba del botón, como "Estás en la mesa 4". */
  aviso?: React.ReactNode;
  /** Si navega a otra pantalla, el canal tapa esta con `CargaMarca` mientras carga. */
  onPedir?: () => void;
  onSoloVer?: () => void;
}) {
  const accent = acentoDe(datos);
  const fotos = fotosDe(datos);
  const conFoto = fotos.length > 0;
  // Sin título cargado, el título grande es el nombre de la empresa.
  const tituloEsNombre = datos.title === datos.name && !datos.titleAccent;

  const pastilla = estado && (
    <span className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-bold">
      {estado.abierto ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <span className="h-2 w-2 rounded-full bg-amber-500" />
      )}
      {estado.texto}
    </span>
  );

  return (
    <div
      className={`relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground ${
        conFoto ? "lg:flex-row" : ""
      }`}
    >
      {conFoto ? (
        /* En una compu (alguien que abrió el link en la PC) queda dividida
           como la plantilla del tótem: la foto a un lado y el panel al otro. */
        <div className="relative h-[40svh] min-h-56 shrink-0 overflow-hidden lg:h-auto lg:min-h-svh lg:flex-1">
          <FotosPortada fotos={fotos} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-background" />
          {pastilla}
        </div>
      ) : (
        /* Sin foto no hay una mitad vacía: el fondo es el del menú, luces del
           color de la marca sobre una grilla, y todo va en una columna. */
        <div
          aria-hidden={!estado}
          className="absolute inset-0 overflow-hidden"
          style={{ "--portada-acento": accent } as React.CSSProperties}
        >
          <div className="portada-grilla" />
          <div className="portada-luz -left-24 -top-24 h-80 w-80" />
          <div className="portada-luz portada-luz-2 -right-20 top-1/3 h-72 w-72" />
          {pastilla}
        </div>
      )}

      <TotemMotas accent={accent} />

      <div
        className={`relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-6 ${
          conFoto
            ? "-mt-16 lg:mt-0 lg:max-w-xl lg:justify-center lg:px-14 lg:py-10"
            : "pt-[22svh] lg:max-w-2xl lg:justify-center lg:pt-10"
        }`}
      >
        <Logo data={datos} conNombre={!tituloEsNombre} />
        {/* El tamaño sigue al ancho: con la letra geométrica, "Empanadas" a 60px
            no entra en un teléfono de 390, ni a 72px en media pantalla de una
            compu. `anywhere` corta solo si igual no entra una palabra sola. */}
        <Title
          data={datos}
          className={`text-[clamp(2.25rem,13vw,3.75rem)] [overflow-wrap:anywhere] ${
            conFoto ? "lg:text-[clamp(3rem,4.6vw,4.5rem)]" : "lg:text-7xl"
          }`}
        />
        {datos.subtitle && (
          <p className="text-balance text-base text-muted-foreground">{datos.subtitle}</p>
        )}
        <Badges data={datos} extra={chips} className="gap-2" />
        {aviso}

        <div className="mt-auto space-y-5 pt-2 lg:mt-4">
          {onPedir ? (
            <button
              type="button"
              className={claseBoton("lg", false)}
              style={estiloBoton(datos)}
              onClick={onPedir}
            >
              <ContenidoBoton data={datos} size="lg" cargando={false} />
            </button>
          ) : (
            <div className={claseBoton("lg", false)} style={estiloBoton(datos)} aria-hidden>
              <ContenidoBoton data={datos} size="lg" cargando={false} />
            </div>
          )}
          {onSoloVer && (
            <button
              type="button"
              onClick={onSoloVer}
              className="block w-full py-1 text-center text-sm font-semibold text-muted-foreground underline underline-offset-4"
            >
              Solo quiero ver el menú
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
