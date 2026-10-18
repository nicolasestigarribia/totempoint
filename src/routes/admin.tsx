import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PantallaCarga } from "@/components/PantallaCarga";
import {
  Flame,
  LogOut,
  Loader2,
  Save,
  AlertTriangle,
  LayoutDashboard,
  FolderTree,
  Package,
  Carrot,
  Boxes,
  Store,
  Warehouse,
  ScrollText,
  Tags,
  DollarSign,
  PanelLeft,
  PanelLeftClose,
  Monitor,
  Users,
  ShieldCheck,
  Eye,
  ChefHat,
  KeyRound,
  CircleDollarSign,
  CreditCard,
  ChevronDown,
  ArrowLeft,
  History,
  Globe,
  Palette,
  Armchair,
  Home,
  Settings2,
  CircleHelp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { me, logout } from "@/lib/api/auth.functions";
import type { PanelSection, PermissionLevel, PermissionMap } from "@/lib/auth/permissions";
import { canViewSection, canEditSection } from "@/lib/auth/permissions";
import { exitBusiness } from "@/lib/api/platform.functions";
import { getMyBusiness, updateMyBusiness, type MyBusiness } from "@/lib/api/business.functions";
import { ReadOnlyContext } from "@/components/admin/readonly";
import { LogoQrContext } from "@/components/qr-logo";
import { LocalesSection } from "@/components/admin/LocalesSection";
import { CategoriasSection } from "@/components/admin/CategoriasSection";
import { ProductosSection } from "@/components/admin/ProductosSection";
import { IngredientesSection } from "@/components/admin/IngredientesSection";
import { CombosSection } from "@/components/admin/CombosSection";
import { DisponibilidadSection } from "@/components/admin/DisponibilidadSection";
import { StockSection } from "@/components/admin/StockSection";
import { MovimientosSection } from "@/components/admin/MovimientosSection";
import { CodigosAccionSection } from "@/components/admin/CodigosAccionSection";
import { PreciosSection } from "@/components/admin/PreciosSection";
import { TotemsSection } from "@/components/admin/TotemsSection";
import { PortadaSection } from "@/components/admin/PortadaSection";
import { OperadoresSection } from "@/components/admin/OperadoresSection";
import { CajaSection } from "@/components/admin/CajaSection";
import { PagosSection } from "@/components/admin/PagosSection";
import { AuditoriaSection } from "@/components/admin/AuditoriaSection";
import { OnlineSection, type PestaniaOnline } from "@/components/admin/OnlineSection";
import { SalonSection } from "@/components/admin/SalonSection";
import { InicioSection } from "@/components/admin/InicioSection";
import { ImageUploadField, LADO_MAXIMO } from "@/components/admin/ImageUploadField";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel — Totempoint" }],
  }),
  component: AdminPage,
});

type SectionId =
  | "inicio"
  | "empresa"
  | "portada"
  | "categorias"
  | "productos"
  | "ingredientes"
  | "combos"
  | "disponibilidad"
  | "stock"
  | "movimientos"
  | "codigos"
  | "precios"
  | "caja"
  | "pagos"
  | "totems"
  | "online"
  | "salon"
  | "operadores"
  | "auditoria";

type NavGroupId = "inicio" | "ventas" | "menu" | "negocio" | "avanzado";

/**
 * Encabezados del nav, en el orden en que se muestran. Arriba lo de todos los
 * días (vender, el menú), después la configuración del negocio, y al final lo
 * avanzado —stock, ingredientes, auditoría—, que arranca cerrado: quien recién
 * empieza no necesita ver dieciséis secciones para cambiar un precio.
 */
const NAV_GROUPS: { id: NavGroupId; label: string; ayuda?: string }[] = [
  { id: "inicio", label: "" },
  { id: "ventas", label: "Ventas" },
  { id: "menu", label: "Menú" },
  { id: "negocio", label: "Mi negocio" },
  {
    id: "avanzado",
    label: "Avanzado",
    ayuda: "Stock, ingredientes, precios por sucursal y registros. No hace falta para vender.",
  },
];

interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  desc: string;
  /** Grupo del nav bajo el que se agrupa el botón. */
  group: NavGroupId;
  /** Secciones que solo ve el dueño de la empresa, no los encargados. */
  ownerOnly?: boolean;
  /** Sección delegable: el encargado la ve si el dueño le dio permiso. */
  permission?: PanelSection;
  /**
   * Sección que se abre desde otra (ej: Portada desde Tótems). No aparece en
   * el nav y lleva un botón para volver a la de origen. Si quien entra no puede
   * ver la de origen, se muestra en el nav como cualquier otra: si no, no
   * tendría forma de llegar.
   */
  parent?: SectionId;
  /** Módulo que se vende aparte: la sección existe solo si la empresa lo tiene. */
  modulo?: "totem" | "online" | "mesas";
}

/**
 * Para qué sirve cada sección, en palabras de quien no conoce el sistema. Se
 * despliega desde "¿Para qué sirve?" en el encabezado.
 */
const AYUDA: Partial<Record<SectionId, string>> = {
  inicio:
    "Es tu resumen: cuántos pedidos y cuánto vendiste hoy, el link para compartir con tus clientes y la lista de lo que te falta para vender. Tocá cualquier paso pendiente y te llevamos a donde se hace.",
  caja: "Acá ves cuánto vendiste en un día o entre dos fechas, separado en efectivo y Mercado Pago. Sirve para hacer la caja al cerrar: lo que dice acá tiene que coincidir con la plata del cajón.",
  productos:
    "Todo lo que vendés. Para empezar alcanza con nombre, precio y una foto. Para dejar de vender algo por un rato, abrilo y desmarcá “A la venta”: no se borra, se pausa.",
  categorias:
    "Son las secciones de tu menú (por ejemplo: Pizzas, Empanadas, Bebidas). Cada producto va en una. El orden en que las dejes acá es el orden en que las ve el cliente.",
  combos:
    "Promos que juntan varios productos a un precio especial, como “Pizza + 6 empanadas”. Podés armar combos fijos o dejar que el cliente elija los gustos.",
  online:
    "Es tu tienda online. Tus clientes abren el link desde el celular, eligen, y el pedido te llega a la comandera. Acá elegís el link, el horario, si hacés envío o solo retiro, y cómo cobrás. El interruptor de arriba abre o cierra los pedidos en el momento.",
  totems:
    "El tótem es la pantalla del mostrador donde el cliente pide solo. Acá creás cada tótem y sacás el link que se abre en la tablet.",
  salon:
    "Si tenés mesas, armá el salón y pegá el QR en cada mesa: el cliente escanea, pide desde su celular y el pedido llega con el número de mesa.",
  portada:
    "Cómo se ve tu menú: colores, letras y la pantalla de bienvenida. Lo que cambies acá se ve igual en el celular de tus clientes y en el tótem.",
  pagos:
    "Cómo te pagan. El efectivo funciona siempre. Para cobrar con Mercado Pago (QR o tarjeta) conectá tu cuenta acá: la plata entra directo a tu cuenta.",
  operadores:
    "Las personas que trabajan con vos. Creales un usuario a la cocina para que atienda los pedidos, o a un encargado, y elegí qué puede ver o cambiar cada uno.",
  empresa:
    "El nombre y el logo de tu negocio, y tus sucursales. Si tenés un solo local, con una sucursal alcanza.",
  disponibilidad:
    "Solo si tenés más de una sucursal: elegí qué productos se venden en cada una. Si algo no se vende en una sucursal, apagalo ahí y en las demás sigue a la venta.",
  precios:
    "Solo si una sucursal cobra distinto que las otras. Si todas cobran igual, no hace falta tocar nada: el precio se pone en Productos.",
  ingredientes:
    "Lo que lleva cada producto. Sirve para dos cosas: controlar el stock de la materia prima y dejar que el cliente saque algo (“sin cebolla”) o agregue un extra.",
  stock:
    "Cuánto te queda de cada cosa en cada sucursal. Cada venta descuenta sola. Cargá lo que tenés la primera vez y cuando compres mercadería.",
  movimientos:
    "El historial de todo lo que entró y salió: compras, roturas, ventas, retiros de caja. Cada movimiento dice quién lo cargó y por qué.",
  codigos:
    "Los motivos que se eligen al cargar un movimiento de stock o de caja (compra, rotura, vencido, retiro). Ya vienen cargados los más comunes.",
  auditoria:
    "El registro de los cambios importantes: quién cambió un precio, un permiso o una forma de cobro, y cuándo. No se puede borrar ni modificar.",
};

const SECTIONS: SectionDef[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: Home,
    desc: "Cómo viene el día, tu link para vender y lo que te falta",
    group: "inicio",
  },
  {
    id: "empresa",
    label: "Datos y sucursales",
    icon: LayoutDashboard,
    desc: "Nombre, logo y sucursales de tu empresa",
    group: "negocio",
    ownerOnly: true,
  },
  {
    id: "totems",
    label: "Tótems",
    icon: Monitor,
    desc: "Enlaces, QR y portada de cada tótem",
    group: "negocio",
    ownerOnly: true,
    modulo: "totem",
  },
  {
    // Es del dueño, como Cobros: decide cuánto se cobra el envío y por dónde
    // entran los pedidos.
    id: "online",
    label: "Pedido online",
    icon: Globe,
    desc: "El link para que tus clientes pidan desde el celular, con retiro o envío",
    group: "negocio",
    ownerOnly: true,
    modulo: "online",
  },
  {
    // Delegable: armar el salón y sacar los QR lo puede hacer un encargado.
    id: "salon",
    label: "Salón",
    icon: Armchair,
    desc: "Las mesas de cada sucursal y el QR con el que se pide desde la mesa",
    group: "negocio",
    permission: "salon",
    modulo: "mesas",
  },
  {
    // Se abre desde el botón "Editar portada" en la sección Tótems. A una
    // empresa sin tótem, la sección Tótems no le aparece y esta va directo al
    // nav: la apariencia (colores, letras) es de la empresa y también la usa el
    // pedido online.
    id: "portada",
    label: "Apariencia",
    icon: Palette,
    desc: "Colores, letras y pantalla de inicio de tu menú",
    group: "negocio",
    permission: "portada",
    parent: "totems",
  },
  {
    id: "categorias",
    label: "Categorías",
    icon: FolderTree,
    desc: "Las secciones de tu menú: pizzas, empanadas, bebidas…",
    group: "menu",
    permission: "categorias",
  },
  {
    id: "productos",
    label: "Productos",
    icon: Package,
    desc: "Lo que vendés, con su precio y su foto. Desde acá también se pausa un producto",
    group: "menu",
    permission: "productos",
  },
  {
    id: "combos",
    label: "Combos",
    icon: Boxes,
    desc: "Promos que juntan varios productos a un precio",
    group: "menu",
    permission: "combos",
  },
  {
    id: "ingredientes",
    permission: "ingredientes",
    label: "Ingredientes",
    icon: Carrot,
    desc: "Lo que lleva cada producto, para el stock y para que el cliente saque o agregue",
    group: "avanzado",
  },
  {
    id: "disponibilidad",
    permission: "disponibilidad",
    label: "Disponibilidad",
    icon: Store,
    desc: "Qué se vende en cada sucursal, si tenés más de una",
    group: "avanzado",
  },
  {
    id: "stock",
    label: "Stock",
    icon: Warehouse,
    desc: "Cuánto te queda de cada cosa en cada sucursal",
    group: "avanzado",
    permission: "stock",
  },
  {
    id: "precios",
    label: "Precios por sucursal",
    icon: DollarSign,
    desc: "Si una sucursal cobra distinto que las otras",
    group: "avanzado",
    permission: "precios",
  },
  // Movimientos y sus motivos van con Stock y no con Caja: el libro es sobre
  // todo de mercadería (compras, roturas, vencidos). También anota retiros y
  // gastos de caja, y lo dice en la descripción, pero lo que se cobra en el
  // día está en Recaudación.
  {
    id: "movimientos",
    permission: "movimientos",
    label: "Movimientos",
    icon: ScrollText,
    desc: "Entradas y salidas de mercadería y de caja, con quién las cargó y por qué",
    group: "avanzado",
  },
  {
    id: "codigos",
    label: "Motivos de movimiento",
    icon: Tags,
    desc: "Los motivos que se eligen al cargar un movimiento: compra, rotura, retiro de caja…",
    group: "avanzado",
    permission: "codigos",
  },
  {
    id: "caja",
    label: "Ventas y caja",
    icon: CircleDollarSign,
    desc: "Cuánto vendiste y cuánto cobraste, por día o entre fechas",
    group: "ventas",
    permission: "caja",
  },
  {
    id: "pagos",
    label: "Formas de cobro",
    icon: CreditCard,
    desc: "Efectivo y Mercado Pago: cómo te pagan tus clientes",
    group: "negocio",
    ownerOnly: true,
  },
  {
    id: "operadores",
    label: "Equipo",
    icon: Users,
    desc: "Los usuarios de tu cocina y tus encargados, con lo que puede hacer cada uno",
    group: "negocio",
    ownerOnly: true,
  },
  {
    // Es el registro de lo que hicieron los demás: no se delega.
    id: "auditoria",
    label: "Auditoría",
    icon: History,
    desc: "Cambios de permisos, precios, cobros y accesos: quién, qué y cuándo",
    group: "avanzado",
    ownerOnly: true,
  },
];

/** El orden dentro de cada grupo: lo que más se usa, primero. */
const ORDEN_NAV: SectionId[] = [
  "inicio",
  "caja",
  "productos",
  "categorias",
  "combos",
  "online",
  "totems",
  "salon",
  "portada",
  "pagos",
  "operadores",
  "empresa",
  "disponibilidad",
  "precios",
  "ingredientes",
  "stock",
  "movimientos",
  "codigos",
  "auditoria",
];

// Superficie elevada para separar paneles del fondo oscuro
const PANEL =
  "rounded-3xl border border-white/10 bg-[oklch(0.17_0.015_20)] shadow-lg shadow-black/40";

interface BrandingProps {
  name: string;
  setName: (v: string) => void;
  logoUrl: string;
  setLogoUrl: (v: string) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
}

function AdminPage() {
  const navigate = useNavigate();
  const doMe = useServerFn(me);
  const doLogout = useServerFn(logout);
  const doExitBusiness = useServerFn(exitBusiness);
  const fetchBusiness = useServerFn(getMyBusiness);
  const saveBusiness = useServerFn(updateMyBusiness);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<MyBusiness | null>(null);
  const [noBusiness, setNoBusiness] = useState(false);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Partial<Record<PanelSection, PermissionLevel>>>(
    {},
  );

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");

  const [section, setSection] = useState<SectionId>("inicio");
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  useEffect(() => setAyudaAbierta(false), [section]);
  // La pestaña con la que se abre la sección, cuando se llega desde el Inicio.
  const [pestania, setPestania] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<NavGroupId, boolean>>({
    avanzado: true,
  } as Record<NavGroupId, boolean>);
  // Lo que cada uno abrió o cerró queda en su navegador: quien usa el stock
  // todos los días no tiene que abrir "Avanzado" cada vez.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("panel-grupos");
      if (guardado) setCollapsedGroups((prev) => ({ ...prev, ...JSON.parse(guardado) }));
    } catch {
      // Sin almacenamiento: queda como viene.
    }
  }, []);
  const toggleGroup = (id: NavGroupId) =>
    setCollapsedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("panel-grupos", JSON.stringify(next));
      } catch {
        // Sin almacenamiento: se olvida al recargar.
      }
      return next;
    });

  // Auto-cierra el sidebar al achicar la ventana (< lg)
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    const onResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const user = await doMe();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      // El superadmin ve todo, pero necesita haber entrado a una empresa desde su panel.
      if (user.roles.includes("superadmin")) {
        if (!user.actingCompanyId) {
          navigate({ to: "/superadmin", replace: true });
          return;
        }
      } else if (!user.roles.includes("owner") && !user.roles.includes("encargado")) {
        navigate({ to: user.roles.includes("kitchen") ? "/kitchen" : "/login", replace: true });
        return;
      }
      if (!mounted) return;
      setEmail(user.email);
      setRoles(user.roles);
      setActingCompanyId(user.actingCompanyId);
      setPermissions(user.permissions);

      const biz = await fetchBusiness();
      if (!mounted) return;
      if (!biz) {
        setNoBusiness(true);
        setLoading(false);
        return;
      }
      setBusiness(biz);
      setName(biz.name ?? "");
      setLogoUrl(biz.logo_url ?? "");
      setPrimaryColor(biz.primary_color ?? "#000000");
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [navigate, doMe, fetchBusiness]);

  const handleExitBusiness = async () => {
    try {
      await doExitBusiness();
    } finally {
      navigate({ to: "/superadmin", replace: true });
    }
  };

  const handleLogout = async () => {
    await doLogout();
    toast.success("Sesión cerrada");
    navigate({ to: "/login", replace: true });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !business.active) return;
    setSaving(true);
    try {
      await saveBusiness({ data: { name, logoUrl, primaryColor } });
      toast.success("Datos de la empresa actualizados");
      setBusiness({ ...business, name, logo_url: logoUrl, primary_color: primaryColor });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const isOwner = roles.includes("owner") || roles.includes("superadmin");
  const visibleSections = [...SECTIONS]
    .sort((x, y) => ORDEN_NAV.indexOf(x.id) - ORDEN_NAV.indexOf(y.id))
    .filter((s) => {
      if (s.modulo === "online" && !business?.online_ordering) return false;
      if (s.modulo === "totem" && !business?.totem_enabled) return false;
      if (s.modulo === "mesas" && !business?.mesas_enabled) return false;
      if (s.ownerOnly) return isOwner;
      if (!s.permission || isOwner) return true;
      return canViewSection(permissions, s.permission);
    });
  // Una sección que se abre desde otra va al nav sólo si la de origen no se ve.
  const enNav = (s: SectionDef) => !s.parent || !visibleSections.some((v) => v.id === s.parent);
  const puedeVerComandera = isOwner || canViewSection(permissions, "comandera");
  // La comandera vive dentro del grupo Empresa (debajo de Tótems). Un encargado
  // con permiso de Comandera pero sin ninguna sección de Empresa dejaría ese
  // grupo vacío, así que en ese caso el enlace cae suelto más abajo.
  // La comandera no es una sección: es un link que va debajo de la sección de
  // un canal. Debajo de Tótems, o de Pedido online si la empresa no tiene
  // tótem. Antes iba siempre debajo de Tótems, y una empresa solo online se
  // quedaba sin forma de llegar a la comandera para aceptar sus pedidos.
  // La comandera es lo primero de Ventas: ahí se atienden los pedidos.
  const current = SECTIONS.find((s) => s.id === section)!;
  const firstVisible = visibleSections.find(enNav)?.id;
  const volverA =
    current.parent && visibleSections.some((v) => v.id === current.parent)
      ? SECTIONS.find((s) => s.id === current.parent)
      : undefined;
  const sectionAllowed = visibleSections.some((s) => s.id === section);

  // Si la sección abierta no está permitida, cae en la primera que sí lo esté.
  useEffect(() => {
    if (firstVisible && !sectionAllowed) setSection(firstVisible);
  }, [firstVisible, sectionAllowed]);

  // Con el menú abierto en un celular, el fondo no se mueve: si no, al
  // deslizar el menú se terminaba moviendo la página de atrás. En pantallas
  // grandes el menú es parte del layout y no tapa nada, así que no aplica.
  useEffect(() => {
    if (!sidebarOpen) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [sidebarOpen]);

  // Con permiso de solo lectura el servidor rechaza cualquier cambio, así que
  // conviene avisarlo arriba de la sección en vez de dejar que falle al guardar.
  const readOnly = Boolean(
    !isOwner && current.permission && !canEditSection(permissions, current.permission),
  );

  if (loading) {
    return <PantallaCarga />;
  }

  if (noBusiness) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="text-2xl font-bold">Usuario sin empresa asignada</h2>
          <p className="mt-2 text-muted-foreground">Contactá al administrador de la plataforma.</p>
          <p className="mt-4 text-xs text-muted-foreground">Sesión: {email}</p>
          <Button variant="outline" className="mt-6" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (business && !business.active) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="text-2xl font-bold">Cuenta suspendida</h2>
          <p className="mt-2 text-muted-foreground">Contactá al administrador.</p>
          <Button variant="outline" className="mt-6" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const branding: BrandingProps = {
    name,
    setName,
    logoUrl,
    setLogoUrl,
    primaryColor,
    setPrimaryColor,
    saving,
    onSave: handleSave,
  };

  return (
    <div className="relative min-h-dvh bg-background lg:flex">
      {/* Backdrop en pantallas chicas */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/40 backdrop-blur transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{business!.name}</p>
            <p className="text-xs text-muted-foreground">Panel admin</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        {/* El menú desliza por su cuenta: con dieciséis secciones no entra en
            la pantalla de un celular, y sin esto el gesto se lo comía la
            página de atrás. overscroll-contain evita que al llegar al final
            el deslizamiento siga en el contenido de abajo. */}
        <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
          {NAV_GROUPS.map((g) => {
            const items = visibleSections.filter((s) => enNav(s) && s.group === g.id);
            const conComandera = g.id === "ventas" && puedeVerComandera;
            if (items.length === 0 && !conComandera) return null;
            // Inicio va suelto arriba, sin encabezado que lo pliegue.
            const collapsed = g.label ? collapsedGroups[g.id] : false;
            return (
              <div key={g.id} className="space-y-1">
                {g.label && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 transition hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      {g.id === "avanzado" && <Settings2 className="h-3.5 w-3.5" />}
                      {g.label}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                )}
                {collapsed && g.ayuda && (
                  <p className="px-3 text-[11px] leading-snug text-muted-foreground/60">
                    {g.ayuda}
                  </p>
                )}
                {!collapsed && conComandera && (
                  /* La comandera no es una sección del panel sino otra
                     pantalla (/kitchen): es donde se atienden los pedidos. */
                  <a
                    href="/kitchen"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  >
                    <ChefHat className="h-5 w-5" />
                    Comandera (pedidos)
                  </a>
                )}
                {!collapsed &&
                  items.map((s) => (
                    <Fragment key={s.id}>
                      <button
                        onClick={() => {
                          setPestania(undefined);
                          setSection(s.id);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          section === s.id || current.parent === s.id
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <s.icon
                          className={`h-5 w-5 ${section === s.id || current.parent === s.id ? "text-primary" : ""}`}
                        />
                        {s.label}
                      </button>
                    </Fragment>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="px-3 pb-1">
          <a
            href="/cuenta"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
          >
            <KeyRound className="h-5 w-5" />
            Mi cuenta
          </a>
        </div>
        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-1 flex-col overflow-x-hidden">
        {actingCompanyId !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-6 py-3 md:px-8">
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Estás viendo <span className="font-semibold">{business!.name}</span> como
              superusuario.
            </p>
            <Button variant="outline" size="sm" onClick={handleExitBusiness}>
              Volver al panel de superadmin
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm md:px-8">
            <Eye className="h-4 w-4 text-amber-400" />
            Solo lectura: podés mirar esta sección, pero no modificarla.
          </div>
        )}
        <div className="flex items-center gap-4 border-b border-border px-6 py-5 md:px-8">
          {!sidebarOpen && (
            <button
              type="button"
              aria-label="Abrir menú"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
          {volverA && (
            <button
              type="button"
              onClick={() => setSection(volverA.id)}
              aria-label={`Volver a ${volverA.label}`}
              title={`Volver a ${volverA.label}`}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{volverA.label}</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{current.label}</h1>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>
          {AYUDA[section] && (
            <button
              type="button"
              onClick={() => setAyudaAbierta((v) => !v)}
              aria-expanded={ayudaAbierta}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden sm:inline">¿Para qué sirve?</span>
            </button>
          )}
        </div>
        {ayudaAbierta && AYUDA[section] && (
          <div className="flex items-start gap-3 border-b border-primary/20 bg-primary/5 px-6 py-4 text-sm md:px-8">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="max-w-3xl leading-relaxed">{AYUDA[section]}</p>
            <button
              type="button"
              onClick={() => setAyudaAbierta(false)}
              aria-label="Cerrar la ayuda"
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6 md:p-8">
          <LogoQrContext.Provider value={business?.logo_url || null}>
            <ReadOnlyContext.Provider value={readOnly}>
              <SectionContent
                section={section}
                business={business!}
                branding={branding}
                panelClass={PANEL}
                onEditPortada={() => setSection("portada")}
                esDueno={isOwner}
                pestania={pestania}
                onIr={(ir) => {
                  const [id, sub] = ir.split(":");
                  const destino = visibleSections.find((s) => s.id === id);
                  if (!destino) {
                    toast.error("No tenés acceso a esa sección");
                    return;
                  }
                  setPestania(sub);
                  setSection(destino.id);
                  window.scrollTo({ top: 0 });
                }}
                puedeComandera={puedeVerComandera}
              />
            </ReadOnlyContext.Provider>
          </LogoQrContext.Provider>
        </div>
      </main>
    </div>
  );
}

// ---------- Contenido por sección ----------
function SectionContent({
  section,
  business,
  branding,
  panelClass,
  onEditPortada,
  esDueno,
  onIr,
  puedeComandera,
  pestania,
}: {
  section: SectionId;
  business: MyBusiness;
  branding: BrandingProps;
  panelClass: string;
  onEditPortada: () => void;
  esDueno: boolean;
  onIr: (seccion: string) => void;
  puedeComandera: boolean;
  pestania?: string;
}) {
  switch (section) {
    case "inicio":
      return <InicioSection panelClass={panelClass} onIr={onIr} puedeComandera={puedeComandera} />;
    case "empresa":
      return (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <BrandingForm business={business} branding={branding} panelClass={panelClass} />
          <LocalesSection panelClass={panelClass} />
        </div>
      );
    case "portada":
      return <PortadaSection panelClass={panelClass} business={business} />;
    case "categorias":
      return <CategoriasSection panelClass={panelClass} />;
    case "productos":
      return <ProductosSection panelClass={panelClass} />;
    case "combos":
      return <CombosSection panelClass={panelClass} />;
    case "ingredientes":
      return <IngredientesSection panelClass={panelClass} />;
    case "disponibilidad":
      return <DisponibilidadSection panelClass={panelClass} />;
    case "stock":
      return <StockSection panelClass={panelClass} />;
    case "movimientos":
      return <MovimientosSection panelClass={panelClass} />;
    case "codigos":
      return <CodigosAccionSection panelClass={panelClass} />;
    case "precios":
      return <PreciosSection panelClass={panelClass} />;
    case "caja":
      return <CajaSection panelClass={panelClass} />;
    case "pagos":
      return <PagosSection panelClass={panelClass} />;
    case "online":
      return (
        <OnlineSection
          panelClass={panelClass}
          pestaniaInicial={pestania as PestaniaOnline | undefined}
        />
      );
    case "salon":
      return <SalonSection panelClass={panelClass} esDueno={esDueno} />;
    case "totems":
      return (
        <TotemsSection panelClass={panelClass} business={business} onEditPortada={onEditPortada} />
      );
    case "operadores":
      return <OperadoresSection panelClass={panelClass} />;
    case "auditoria":
      return <AuditoriaSection panelClass={panelClass} />;
  }
}

function BrandingForm({
  business,
  branding,
  panelClass,
}: {
  business: MyBusiness;
  branding: BrandingProps;
  panelClass: string;
}) {
  const { name, setName, logoUrl, setLogoUrl, primaryColor, setPrimaryColor, saving, onSave } =
    branding;
  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-start justify-between gap-4 p-6 ${panelClass}`}>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Empresa</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">{business.name}</h2>
        </div>
        <span className="rounded-full bg-green-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-green-500">
          Activo
        </span>
      </div>

      <form onSubmit={onSave} className={`space-y-6 p-6 ${panelClass}`}>
        <div>
          <h3 className="text-xl font-bold">Marca de la empresa</h3>
          <p className="text-sm text-muted-foreground">Datos visibles para tus clientes.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Nombre visible</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="md:col-span-2">
            <ImageUploadField
              id="logo"
              label="Logo"
              value={logoUrl}
              onChange={setLogoUrl}
              maxSide={LADO_MAXIMO.logo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color principal</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-16 cursor-pointer p-1"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#000000"
                className="h-11 flex-1"
              />
            </div>
          </div>
        </div>
        <Button type="submit" disabled={saving} className="h-12 gap-2 px-8 font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </form>
    </div>
  );
}
