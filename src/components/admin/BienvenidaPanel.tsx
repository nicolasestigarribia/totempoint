import { useState } from "react";
import { ArrowRight, ChefHat, Home, ListChecks, Package, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * La bienvenida la primera vez que el dueño entra al panel: qué es esto, cómo
 * se usa y por dónde empezar. Tres pantallas cortas y una salida concreta
 * ("cargar mi primer producto" o "ver qué me falta"), porque quien acaba de
 * comprar el sistema no sabe en cuál de las secciones arrancar.
 */
export function BienvenidaPanel({
  abierta,
  empresa,
  tieneProductos,
  onCerrar,
  onIr,
}: {
  abierta: boolean;
  empresa: string;
  /** Si ya cargó productos: entonces la salida es ver qué le falta. */
  tieneProductos: boolean;
  onCerrar: () => void;
  onIr: (seccion: string) => void;
}) {
  const [paso, setPaso] = useState(0);
  const pasos = [
    {
      icono: <Sparkles className="h-8 w-8" />,
      titulo: `¡Bienvenido, ${empresa}!`,
      texto: (
        <>
          Desde este panel manejás todo tu negocio. Tus clientes piden solos, desde el celular o
          desde el tótem del mostrador, y los pedidos te llegan ordenados a la cocina. Sin WhatsApp,
          sin anotar a mano.
        </>
      ),
    },
    {
      icono: <ListChecks className="h-8 w-8" />,
      titulo: "Así se usa",
      texto: (
        <ul className="space-y-3 text-left">
          <Punto icono={<Home className="h-5 w-5" />} titulo="Inicio">
            Cómo viene el día y qué te falta para vender. Siempre empezás acá.
          </Punto>
          <Punto icono={<Package className="h-5 w-5" />} titulo="Menú">
            Tus productos con su precio y su foto. Desde ahí también pausás algo que se terminó.
          </Punto>
          <Punto icono={<ChefHat className="h-5 w-5" />} titulo="Comandera">
            La pantalla de la cocina: entran los pedidos, los aceptás, los preparás y los entregás.
          </Punto>
          <Punto icono={<Smartphone className="h-5 w-5" />} titulo="Tu link">
            El que compartís en Instagram y WhatsApp para que te pidan.
          </Punto>
        </ul>
      ),
    },
    {
      icono: <ArrowRight className="h-8 w-8" />,
      titulo: "Empecemos",
      texto: tieneProductos ? (
        <>
          Ya tenés productos cargados. En el Inicio vas a ver una lista con lo que falta para
          vender: tocá cada paso y te llevamos a donde se hace.
        </>
      ) : (
        <>
          Lo primero es cargar lo que vendés. Con nombre, precio y una foto alcanza. Después, el
          Inicio te va mostrando lo que falta.
        </>
      ),
    },
  ];
  const ultimo = paso === pasos.length - 1;
  const actual = pasos[paso];

  const cerrar = () => {
    setPaso(0);
    onCerrar();
  };

  return (
    <Dialog open={abierta} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-w-lg">
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
            {actual.icono}
          </span>
          <DialogTitle className="text-3xl">{actual.titulo}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-base leading-relaxed text-muted-foreground">{actual.texto}</div>
          </DialogDescription>

          {/* Dónde está: tres puntitos. */}
          <div className="flex gap-2" aria-hidden>
            {pasos.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${i === paso ? "w-6 bg-primary" : "w-2 bg-white/20"}`}
              />
            ))}
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
            {ultimo ? (
              <Button
                className="h-12 flex-1 gap-2 font-bold"
                onClick={() => {
                  cerrar();
                  onIr(tieneProductos ? "inicio" : "productos");
                }}
              >
                {tieneProductos ? "Ver qué me falta" : "Cargar mi primer producto"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="h-12 flex-1 gap-2 font-bold" onClick={() => setPaso(paso + 1)}>
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {paso > 0 ? (
              <Button variant="outline" className="h-12" onClick={() => setPaso(paso - 1)}>
                Atrás
              </Button>
            ) : (
              <Button variant="ghost" className="h-12 text-muted-foreground" onClick={cerrar}>
                Saltear
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Punto({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
        {icono}
      </span>
      <span>
        <span className="block font-bold text-foreground">{titulo}</span>
        <span className="text-sm">{children}</span>
      </span>
    </li>
  );
}
