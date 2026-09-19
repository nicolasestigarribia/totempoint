import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Flame,
  LogOut,
  Loader2,
  Save,
  AlertTriangle,
  LayoutDashboard,
  MapPin,
  FolderTree,
  Package,
  Carrot,
  Boxes,
  Store,
  Warehouse,
  ScrollText,
  Tags,
  PanelLeft,
  PanelLeftClose,
  Monitor,
  Users,
  ShieldCheck,
  Eye,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import { me, logout } from "@/lib/api/auth.functions";
import type { PanelSection, PermissionLevel, PermissionMap } from "@/lib/auth/permissions";
import { canViewSection, canEditSection } from "@/lib/auth/permissions";
import { exitBusiness } from "@/lib/api/platform.functions";
import { getMyBusiness, updateMyBusiness, type MyBusiness } from "@/lib/api/business.functions";
import { ReadOnlyContext } from "@/components/admin/readonly";
import { LocalesSection } from "@/components/admin/LocalesSection";
import { CategoriasSection } from "@/components/admin/CategoriasSection";
import { ProductosSection } from "@/components/admin/ProductosSection";
import { IngredientesSection } from "@/components/admin/IngredientesSection";
import { CombosSection } from "@/components/admin/CombosSection";
import { DisponibilidadSection } from "@/components/admin/DisponibilidadSection";
import { StockSection } from "@/components/admin/StockSection";
import { MovimientosSection } from "@/components/admin/MovimientosSection";
import { CodigosAccionSection } from "@/components/admin/CodigosAccionSection";
import { PortadaSection } from "@/components/admin/PortadaSection";
import { OperadoresSection } from "@/components/admin/OperadoresSection";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel — Totempoint" }],
  }),
  component: AdminPage,
});

type SectionId =
  | "resumen"
  | "portada"
  | "locales"
  | "categorias"
  | "productos"
  | "ingredientes"
  | "combos"
  | "disponibilidad"
  | "stock"
  | "movimientos"
  | "codigos"
  | "operadores";

interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  desc: string;
  /** Secciones que solo ve el dueño de la empresa, no los encargados. */
  ownerOnly?: boolean;
  /** Sección delegable: el encargado la ve si el dueño le dio permiso. */
  permission?: PanelSection;
}

const SECTIONS: SectionDef[] = [
  {
    id: "resumen",
    label: "Resumen",
    icon: LayoutDashboard,
    desc: "Datos y marca de tu empresa",
    ownerOnly: true,
  },
  {
    id: "portada",
    label: "Portada",
    icon: Monitor,
    desc: "Pantalla de inicio de tu tótem",
    permission: "portada",
  },
  {
    id: "locales",
    label: "Negocios",
    icon: MapPin,
    desc: "Sucursales de tu empresa",
    ownerOnly: true,
  },
  {
    id: "categorias",
    label: "Categorías",
    icon: FolderTree,
    desc: "Categorías del menú",
    permission: "categorias",
  },
  {
    id: "productos",
    label: "Productos",
    icon: Package,
    desc: "Productos y precios",
    permission: "productos",
  },
  {
    id: "combos",
    label: "Combos",
    icon: Boxes,
    desc: "Combos armados con productos",
    permission: "combos",
  },
  {
    id: "ingredientes",
    permission: "ingredientes",
    label: "Ingredientes",
    icon: Carrot,
    desc: "Ingredientes de tus productos",
  },
  {
    id: "disponibilidad",
    permission: "disponibilidad",
    label: "Disponibilidad",
    icon: Store,
    desc: "Qué se muestra en cada negocio",
  },
  {
    id: "stock",
    label: "Stock",
    icon: Warehouse,
    desc: "Stock de ingredientes por negocio",
    permission: "stock",
  },
  {
    id: "movimientos",
    permission: "movimientos",
    label: "Movimientos",
    icon: ScrollText,
    desc: "Historial de movimientos de la empresa",
  },
  {
    id: "codigos",
    label: "Códigos de acción",
    icon: Tags,
    desc: "Motivos de ingresos y egresos",
    permission: "codigos",
  },
  {
    id: "operadores",
    label: "Operadores",
    icon: Users,
    desc: "Encargados y los negocios que manejan",
    ownerOnly: true,
  },
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

  const [section, setSection] = useState<SectionId>("resumen");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  const visibleSections = SECTIONS.filter((s) => {
    if (s.ownerOnly) return isOwner;
    if (!s.permission || isOwner) return true;
    return canViewSection(permissions, s.permission);
  });
  const puedeVerComandera = isOwner || canViewSection(permissions, "comandera");
  const current = SECTIONS.find((s) => s.id === section)!;
  const firstVisible = visibleSections[0]?.id;
  const sectionAllowed = visibleSections.some((s) => s.id === section);

  // Si la sección abierta no está permitida, cae en la primera que sí lo esté.
  useEffect(() => {
    if (firstVisible && !sectionAllowed) setSection(firstVisible);
  }, [firstVisible, sectionAllowed]);

  // Con permiso de solo lectura el servidor rechaza cualquier cambio, así que
  // conviene avisarlo arriba de la sección en vez de dejar que falle al guardar.
  const readOnly = Boolean(
    !isOwner && current.permission && !canEditSection(permissions, current.permission),
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
        <nav className="flex-1 space-y-1 p-3">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSection(s.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                section === s.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <s.icon className={`h-5 w-5 ${section === s.id ? "text-primary" : ""}`} />
              {s.label}
            </button>
          ))}
        </nav>
        {/*
          La comandera no es una sección del panel sino otra pantalla (/kitchen),
          así que no entra en el nav de arriba. Sin este enlace, a quien le
          habilitan "Comandera" no le queda forma de llegar.
        */}
        {puedeVerComandera && (
          <div className="px-3 pb-1">
            <a
              href="/kitchen"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <ChefHat className="h-5 w-5" />
              Comandera
            </a>
          </div>
        )}
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{current.label}</h1>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>
        </div>
        <div className="p-6 md:p-8">
          <ReadOnlyContext.Provider value={readOnly}>
            <SectionContent
              section={section}
              business={business!}
              branding={branding}
              panelClass={PANEL}
            />
          </ReadOnlyContext.Provider>
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
}: {
  section: SectionId;
  business: MyBusiness;
  branding: BrandingProps;
  panelClass: string;
}) {
  switch (section) {
    case "resumen":
      return <BrandingForm business={business} branding={branding} panelClass={panelClass} />;
    case "portada":
      return <PortadaSection panelClass={panelClass} business={business} />;
    case "locales":
      return <LocalesSection panelClass={panelClass} />;
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
    case "operadores":
      return <OperadoresSection panelClass={panelClass} />;
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
          <p className="mt-2 text-sm text-muted-foreground">
            Slug: <code className="rounded bg-white/10 px-2 py-0.5">{business.slug}</code>
          </p>
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
            <ImageUploadField id="logo" label="Logo" value={logoUrl} onChange={setLogoUrl} />
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
