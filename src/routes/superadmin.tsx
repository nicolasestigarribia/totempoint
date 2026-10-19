import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { me, logout } from "@/lib/api/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  KeyRound,
  Building2,
  Receipt,
  PanelLeft,
  PanelLeftClose,
  LogIn,
  UserPlus,
  Link2,
  Monitor,
  Globe,
  Armchair,
  Bug,
  Search,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createBusiness,
  listBusinesses,
  setBusinessActive,
  updateBusinessAdmin,
  assignBusinessOwner,
  updateBusinessSlug,
  enterBusiness,
  setBusinessModule,
  type BusinessRow,
} from "@/lib/api/platform.functions";
import { FacturacionSection } from "@/components/admin/FacturacionSection";
import { LogsSection } from "@/components/admin/LogsSection";
import { PantallaCarga } from "@/components/PantallaCarga";
import { PASSWORD_HINT, PASSWORD_MIN } from "@/lib/auth/password-policy";
import { mensajeDeError } from "@/lib/error-message";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Superadmin — Totempoint" },
      {
        name: "description",
        content: "Panel del administrador general: empresas, altas y estado de cada cuenta.",
      },
      { property: "og:title", content: "Superadmin — Totempoint" },
      {
        property: "og:description",
        content: "Panel del administrador general de la plataforma Totempoint.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperadminPage,
});

// El panel de plataforma administra empresas y mira cuánto factura cada una:
// el catálogo (ingredientes, categorías, códigos de acción) es de cada empresa.
type SectionId = "negocios" | "facturacion" | "logs";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; desc: string }[] = [
  {
    id: "negocios",
    label: "Empresas",
    icon: Building2,
    desc: "Marcas dadas de alta en la plataforma",
  },
  {
    id: "facturacion",
    label: "Facturación",
    icon: Receipt,
    desc: "Cuánto factura cada empresa",
  },
  {
    id: "logs",
    label: "Errores",
    icon: Bug,
    desc: "Excepciones y fallos del sistema",
  },
];

function SuperadminPage() {
  const navigate = useNavigate();
  const fetchBusinesses = useServerFn(listBusinesses);
  const create = useServerFn(createBusiness);
  const toggleActive = useServerFn(setBusinessActive);
  const toggleModule = useServerFn(setBusinessModule);
  const updateAdmin = useServerFn(updateBusinessAdmin);
  const assignOwner = useServerFn(assignBusinessOwner);
  const changeSlug = useServerFn(updateBusinessSlug);
  const doEnterBusiness = useServerFn(enterBusiness);
  const doMe = useServerFn(me);
  const doLogout = useServerFn(logout);

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("negocios");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  // Qué contrata la empresa nueva. El tótem viene marcado porque es lo más
  // común; una empresa solo online lo desmarca.
  const [conTotem, setConTotem] = useState(true);
  const [conOnline, setConOnline] = useState(false);
  const [conMesas, setConMesas] = useState(false);
  const [cambiandoModulo, setCambiandoModulo] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // Empresa a la que se le está dando dueño, y empresa a la que se le está
  // cambiando la dirección del tótem.
  const [ownerRow, setOwnerRow] = useState<BusinessRow | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [slugRow, setSlugRow] = useState<BusinessRow | null>(null);
  const [slugValue, setSlugValue] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);

  const [editRow, setEditRow] = useState<BusinessRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const user = await doMe();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setEmail(user.email);
      try {
        const data = await fetchBusinesses();
        if (mounted) setRows(data);
      } catch {
        toast.error("No tenés permisos de superadmin");
        navigate({ to: "/admin", replace: true });
        return;
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [navigate, fetchBusinesses, doMe]);

  const reload = async () => {
    try {
      setRows(await fetchBusinesses());
    } catch {
      /* noop */
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await create({
        data: {
          name,
          adminEmail,
          adminUsername,
          adminPassword,
          totem: conTotem,
          online: conOnline,
          mesas: conMesas,
        },
      });
      toast.success("Empresa creada");
      setName("");
      setAdminEmail("");
      setAdminUsername("");
      setAdminPassword("");
      setConTotem(true);
      setConOnline(false);
      setConMesas(false);
      setOpen(false);
      await reload();
    } catch (err: unknown) {
      toast.error(mensajeDeError(err, "No se pudo crear la empresa"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: BusinessRow) => {
    setEditRow(row);
    setEditEmail(row.admin_email ?? "");
    setEditUsername(row.admin_username ?? "");
    setEditPassword("");
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow?.admin_user_id) return;
    setEditing(true);
    try {
      await updateAdmin({
        data: {
          userId: editRow.admin_user_id,
          email: editEmail,
          username: editUsername,
          password: editPassword || null,
        },
      });
      toast.success("Acceso del dueño actualizado");
      setEditRow(null);
      await reload();
    } catch (err: unknown) {
      toast.error(mensajeDeError(err, "No se pudo actualizar"));
    } finally {
      setEditing(false);
    }
  };

  const openAssignOwner = (row: BusinessRow) => {
    setOwnerRow(row);
    setOwnerEmail("");
    setOwnerUsername("");
    setOwnerPassword("");
  };

  const handleAssignOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerRow) return;
    setAssigning(true);
    try {
      await assignOwner({
        data: {
          companyId: ownerRow.id,
          email: ownerEmail,
          username: ownerUsername,
          password: ownerPassword,
        },
      });
      toast.success("Dueño asignado");
      setOwnerRow(null);
      await reload();
    } catch (err: unknown) {
      toast.error(mensajeDeError(err, "No se pudo asignar el dueño"));
    } finally {
      setAssigning(false);
    }
  };

  const openSlug = (row: BusinessRow) => {
    setSlugRow(row);
    setSlugValue(row.slug);
  };

  const handleSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slugRow) return;
    setSavingSlug(true);
    try {
      await changeSlug({ data: { companyId: slugRow.id, slug: slugValue } });
      toast.success("Link actualizado");
      setSlugRow(null);
      await reload();
    } catch (err: unknown) {
      toast.error(mensajeDeError(err, "No se pudo cambiar la dirección"));
    } finally {
      setSavingSlug(false);
    }
  };

  // Entrar al panel de una empresa: el superadmin ve y opera todo como el dueño.
  const handleEnter = async (row: BusinessRow) => {
    try {
      await doEnterBusiness({ data: { companyId: row.id } });
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo entrar a la empresa"));
    }
  };

  const handleToggle = async (row: BusinessRow) => {
    try {
      await toggleActive({ data: { id: row.id, active: !row.active } });
      await reload();
    } catch {
      toast.error("No se pudo cambiar el estado");
    }
  };

  const handleModulo = async (row: BusinessRow, modulo: "totem" | "online" | "mesas") => {
    const actual = {
      totem: row.totem_enabled,
      online: row.online_ordering,
      mesas: row.mesas_enabled,
    }[modulo];
    setCambiandoModulo(`${row.id}-${modulo}`);
    try {
      await toggleModule({ data: { id: row.id, modulo, enabled: !actual } });
      toast.success(
        `${actual ? "Quitado" : "Habilitado"}: ${{ totem: "Tótem", online: "Pedido online", mesas: "Mesas" }[modulo]} en ${row.name}`,
      );
      await reload();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cambiar el módulo"));
    } finally {
      setCambiandoModulo(null);
    }
  };

  const handleLogout = async () => {
    await doLogout();
    navigate({ to: "/login", replace: true });
  };

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    const onResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Con el menú abierto en un celular el fondo se queda quieto, para que el
  // deslizamiento sea del menú y no de la página de atrás.
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

  if (loading) {
    return <PantallaCarga marca={false} />;
  }

  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="relative min-h-dvh bg-background lg:flex">
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
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Plataforma</p>
            <p className="text-sm font-bold">Superadmin</p>
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
        {/* Igual que en el panel de empresa: el menú desliza por su cuenta. */}
        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          {SECTIONS.map((s) => (
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
          {section === "facturacion" ? (
            <FacturacionSection />
          ) : section === "logs" ? (
            <LogsSection />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">Sesión: {email}</p>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Crear empresa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nueva empresa</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="biz-name">Nombre de la empresa</Label>
                        <Input
                          id="biz-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          minLength={2}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-email">Email del administrador</Label>
                        <Input
                          id="biz-email"
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-username">Usuario</Label>
                        <Input
                          id="biz-username"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          required
                          minLength={3}
                          placeholder="ej: burguerdemo"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-password">Contraseña</Label>
                        <Input
                          id="biz-password"
                          type="text"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          required
                          minLength={PASSWORD_MIN}
                          placeholder={PASSWORD_HINT}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Qué contrata</Label>
                        <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={conTotem}
                            onChange={(e) => setConTotem(e.target.checked)}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          Tótem de autopedido
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={conOnline}
                            onChange={(e) => setConOnline(e.target.checked)}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          Pedido online (retiro y envío)
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={conMesas}
                            onChange={(e) => setConMesas(e.target.checked)}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <Armchair className="h-4 w-4 text-muted-foreground" />
                          Pedido en la mesa (QR por mesa)
                        </label>
                        {!conTotem && !conOnline && !conMesas && (
                          <p className="text-xs text-destructive">Elegí al menos uno.</p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={saving || (!conTotem && !conOnline && !conMesas)}
                        className="w-full gap-2"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Crear
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* De un vistazo: cuántas venden, cuántas faltan configurar. */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Resumen titulo="Empresas activas" valor={rows.filter((r) => r.active).length} />
                <Resumen titulo="Pedidos hoy" valor={rows.reduce((t, r) => t + r.pedidos_hoy, 0)} />
                <Resumen
                  titulo="Sin dueño"
                  valor={rows.filter((r) => r.active && !r.admin_user_id).length}
                  alerta
                />
                <Resumen
                  titulo="Sin pedidos en 7 días"
                  valor={rows.filter((r) => r.active && r.pedidos_7d === 0).length}
                  alerta
                />
              </div>

              <label className="relative block max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar empresa, link o email…"
                  className="h-11 pl-9"
                />
              </label>

              {rows.length === 0 && (
                <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  Todavía no hay empresas.
                </p>
              )}
              <div className="grid gap-4 xl:grid-cols-2">
                {rows
                  .filter((b) => {
                    const t = busqueda.trim().toLowerCase();
                    return (
                      !t ||
                      b.name.toLowerCase().includes(t) ||
                      b.slug.includes(t) ||
                      (b.admin_email ?? "").toLowerCase().includes(t)
                    );
                  })
                  .map((b) => (
                    <article
                      key={b.id}
                      className={`space-y-4 rounded-3xl border bg-card p-5 shadow-lg ${
                        b.active ? "border-border" : "border-destructive/40 opacity-75"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            /{b.slug}
                            {" · "}
                            {b.admin_email ?? (
                              <span className="font-bold text-amber-400">sin dueño</span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                            b.active
                              ? "bg-green-500/15 text-green-500"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {b.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      {/* La actividad: lo que dice si la empresa está usando el
                          sistema o quedó a medio configurar. */}
                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.03] p-3 text-center">
                        <Dato valor={b.pedidos_hoy} etiqueta="pedidos hoy" />
                        <Dato valor={b.pedidos_7d} etiqueta="en 7 días" />
                        <Dato valor={b.productos} etiqueta="productos" alerta={b.productos === 0} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.ultimo_pedido
                          ? `Último pedido ${haceCuanto(b.ultimo_pedido)}`
                          : "Todavía no recibió pedidos"}
                      </p>

                      {/* Cada módulo se prende y se apaga por separado: se
                          venden aparte, y una empresa puede tener uno solo. */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs text-muted-foreground">Contrató:</span>
                        {(
                          [
                            { id: "totem", label: "Tótem", icon: Monitor, on: b.totem_enabled },
                            { id: "online", label: "Online", icon: Globe, on: b.online_ordering },
                            { id: "mesas", label: "Mesas", icon: Armchair, on: b.mesas_enabled },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleModulo(b, m.id)}
                            disabled={cambiandoModulo !== null}
                            aria-pressed={m.on}
                            title={m.on ? `Quitar ${m.label}` : `Habilitar ${m.label}`}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                              m.on
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-dashed border-border text-muted-foreground opacity-70 hover:opacity-100"
                            }`}
                          >
                            {cambiandoModulo === `${b.id}-${m.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <m.icon className="h-3 w-3" />
                            )}
                            {m.on ? m.label : `+ ${m.label}`}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button size="sm" className="gap-1" onClick={() => handleEnter(b)}>
                          <LogIn className="h-3.5 w-3.5" />
                          Entrar
                        </Button>
                        {b.admin_user_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEdit(b)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Acceso del dueño
                          </Button>
                        ) : (
                          <Button size="sm" className="gap-1" onClick={() => openAssignOwner(b)}>
                            <UserPlus className="h-3.5 w-3.5" />
                            Asignar dueño
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openSlug(b)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Cambiar link
                        </Button>
                        <a
                          href={`/p/${b.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition hover:border-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-muted-foreground"
                          onClick={() => handleToggle(b)}
                        >
                          {b.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={ownerRow !== null} onOpenChange={(o) => !o && setOwnerRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar dueño — {ownerRow?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignOwner} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene dueño, así que nadie de la sucursal puede entrar al panel. El
              usuario que crees acá queda como dueño y administra todo lo suyo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Email</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-username">Usuario</Label>
              <Input
                id="owner-username"
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value)}
                required
                minLength={3}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-password">Contraseña</Label>
              <Input
                id="owner-password"
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={PASSWORD_MIN}
                placeholder={PASSWORD_HINT}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={assigning} className="w-full gap-2">
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear dueño
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={slugRow !== null} onOpenChange={(o) => !o && setSlugRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de la empresa — {slugRow?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSlug} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug-value">Dirección</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-muted-foreground">/t/</span>
                <Input
                  id="slug-value"
                  value={slugValue}
                  onChange={(e) =>
                    // Se normaliza al tipear: así nadie manda espacios ni
                    // mayúsculas y ve el error recién al guardar.
                    setSlugValue(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, "-")
                        .replace(/-{2,}/g, "-")
                        .replace(/^-+/, ""),
                    )
                  }
                  required
                  minLength={3}
                  placeholder="sangucheria-primorosas"
                  className="h-11"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minúsculas, números y guiones. Va en los links del tótem (/t/…) y del pedido online
                (/p/…). El link corto del pedido online no cambia.
              </p>
            </div>
            <p className="text-sm text-amber-400">
              Si la cambiás, los links anteriores dejan de funcionar: hay que volver a cargar la
              dirección en las tablets, y los QR ya impresos quedan sin uso (salvo los del link
              corto).
            </p>
            <Button type="submit" disabled={savingSlug} className="w-full gap-2">
              {savingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar dirección
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acceso del dueño — {editRow?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Usuario</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
                minLength={3}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nueva contraseña</Label>
              <Input
                id="edit-password"
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={PASSWORD_MIN}
                placeholder="Dejar vacío para no cambiar"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={editing} className="w-full gap-2">
              {editing && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "hace 2 h", "ayer", "hace 5 días". */
function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function Resumen({
  titulo,
  valor,
  alerta = false,
}: {
  titulo: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        alerta && valor > 0 ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${alerta && valor > 0 ? "text-amber-300" : ""}`}>
        {valor}
      </p>
    </div>
  );
}

function Dato({
  valor,
  etiqueta,
  alerta = false,
}: {
  valor: number;
  etiqueta: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <p className={`text-xl font-bold ${alerta ? "text-amber-300" : ""}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
