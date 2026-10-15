import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getOnlineEmpresa } from "@/lib/api/totem.functions";
import { OnlineError } from "@/components/online/OnlineError";
import { ogMeta } from "@/lib/og";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { estadoHorario } from "@/lib/horario";
import { PortadaCelular, type EstadoPortada } from "@/components/online/PortadaCelular";
import { HojaPedir, useElegirSucursal, type PasoHoja } from "@/components/online/HojaPedir";
import { CargaMarca } from "@/components/CargaMarca";

/**
 * La portada del pedido online de la empresa: la misma pantalla de inicio del
 * tótem, en el teléfono (`PortadaCelular`). Pedir abre una hoja que pregunta
 * envío o retiro, la dirección y la sucursal (`HojaPedir`); "Solo quiero ver
 * el menú" es para el QR pegado en el local.
 *
 * Se muestra aunque haya una sola sucursal, porque es la portada de la marca:
 * ahí retirar y mirar van directo, sin una lista de una.
 */
export const Route = createFileRoute("/p/$empresa/")({
  loader: async ({ params }) => {
    return getOnlineEmpresa({ data: { empresa: params.empresa } });
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Pedí online — ${loaderData.name}` : "Pedido online" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // El link de la empresa es el que más se comparte por WhatsApp.
      ...(loaderData
        ? ogMeta({
            title: loaderData.name,
            description: `Hacé tu pedido online a ${loaderData.name}`,
          })
        : []),
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: EmpresaPage,
});

function EmpresaPage() {
  const empresa = Route.useLoaderData();
  useTotemTheme(empresa.accentColor, empresa.theme, empresa.fontTheme, empresa.corners);
  const elegir = useElegirSucursal(empresa);
  const [paso, setPaso] = useState<PasoHoja | null>(null);

  const hayEnvio = empresa.sucursales.some((s) => s.delivery);
  const retiro = empresa.sucursales.filter((s) => s.pickup);
  const unica = empresa.sucursales.length === 1 ? empresa.sucursales[0] : null;

  const pedir = () => {
    if (hayEnvio && retiro.length > 0) setPaso("como");
    else if (hayEnvio) setPaso("envio");
    // Solo retiro y en un solo lugar: no hay nada que preguntar.
    else if (retiro.length === 1) elegir.pedir(retiro[0], "mostrador", null);
    else setPaso("retiro");
  };
  const soloVer = () => (unica ? elegir.ver(unica) : setPaso("ver"));

  return (
    <>
      <PortadaCelular
        datos={empresa.portada}
        estado={estadoDeEmpresa(empresa.sucursales.map((s) => s.horarios))}
        chips={[
          hayEnvio && retiro.length > 0
            ? "Envío y retiro"
            : hayEnvio
              ? "Envío a domicilio"
              : "Retiro en el local",
        ]}
        onPedir={pedir}
        onSoloVer={soloVer}
      />
      <HojaPedir empresa={empresa} elegir={elegir} paso={paso} onPaso={setPaso} />
      {elegir.yendo && (
        <CargaMarca
          logoUrl={empresa.portada.logoUrl}
          nombre={empresa.portada.name}
          texto="Preparando el menú…"
          accent={empresa.accentColor}
        />
      )}
    </>
  );
}

/**
 * La pastilla de la foto. Abierta si alguna sucursal lo está; cerrada, cuándo
 * abre la primera. Sin horarios cargados no dice nada: abierto siempre no es
 * una noticia.
 */
function estadoDeEmpresa(horarios: Parameters<typeof estadoHorario>[0][]): EstadoPortada | null {
  const estados = horarios.map((h) => estadoHorario(h));
  const abierta = estados.find((e) => e.abierto);
  if (abierta) return abierta.texto ? { abierto: true, texto: `Abierto · ${abierta.texto}` } : null;
  const abre = estados.find((e) => e.texto)?.texto;
  return { abierto: false, texto: abre ? `Cerrado · abre ${abre}` : "Cerrado" };
}
