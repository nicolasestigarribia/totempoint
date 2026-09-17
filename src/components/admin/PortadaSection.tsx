import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, ExternalLink, Monitor } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { TotemHome } from "@/components/totem/TotemHome";
import { PreviewFrame } from "@/components/admin/PreviewFrame";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { TotemLinkCard } from "@/components/admin/TotemLinkCard";
import {
  getMyTotemSettings,
  updateMyTotemSettings,
  type MyTotemSettings,
  type MyBusiness,
} from "@/lib/api/business.functions";
import type { TotemHome as TotemHomeData, TotemTemplate } from "@/lib/api/totem.functions";

const TEMPLATES: { value: TotemTemplate; label: string; hint: string }[] = [
  {
    value: "clasico",
    label: "Clásico",
    hint: "Imagen de fondo, texto a la izquierda y botón a la derecha",
  },
  {
    value: "completo",
    label: "Pantalla completa",
    hint: "Imagen a sangre con todo centrado y botón gigante",
  },
  { value: "split", label: "Dividido", hint: "Mitad imagen, mitad panel sólido" },
];

// Bases de color de las pantallas de adentro. El color de acento las tiñe.
const BASES: { value: MyTotemSettings["theme"]; label: string; hint: string }[] = [
  { value: "oscuro", label: "Oscura", hint: "Fondo negro tibio, teñido con tu color" },
  { value: "claro", label: "Clara", hint: "Fondo claro, para panaderías y cafés" },
  { value: "calido", label: "Cálida", hint: "Marrones y tierra, para parrillas y bodegones" },
];

const EMPTY: MyTotemSettings = {
  template: "clasico",
  theme: "oscuro",
  heroImageUrl: "",
  eyebrow: "",
  title: "",
  titleAccent: "",
  subtitle: "",
  ctaLabel: "Empezar pedido",
  badge1: "",
  badge2: "",
  accentColor: "",
};

export function PortadaSection({
  panelClass,
  business,
}: {
  panelClass: string;
  business: MyBusiness;
}) {
  const fetchSettings = useServerFn(getMyTotemSettings);
  const save = useServerFn(updateMyTotemSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MyTotemSettings>(EMPTY);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await fetchSettings();
        if (mounted && s) setForm(s);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la portada");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchSettings]);

  const set = <K extends keyof MyTotemSettings>(key: K, value: MyTotemSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: form });
      toast.success("Portada actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const preview: TotemHomeData = {
    companyId: business.id,
    name: business.name,
    slug: business.slug,
    logoUrl: business.logo_url,
    primaryColor: business.primary_color,
    template: form.template,
    heroImageUrl: form.heroImageUrl || null,
    eyebrow: form.eyebrow || null,
    title: form.title.trim() || business.name,
    titleAccent: form.titleAccent || null,
    subtitle: form.subtitle || null,
    ctaLabel: form.ctaLabel.trim() || "Empezar pedido",
    theme: form.theme,
    badge1: form.badge1 || null,
    badge2: form.badge2 || null,
    accentColor: form.accentColor || null,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-4 p-6 ${panelClass}`}>
        <div>
          <h2 className="text-xl font-bold">Pantalla de tu tótem</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Así ven tus clientes la pantalla de inicio antes de pedir.
          </p>
        </div>
        <a
          href={`/t/${business.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:border-primary"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir /t/{business.slug}
        </a>
      </div>

      <TotemLinkCard slug={business.slug} panelClass={panelClass} />

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className={`space-y-6 p-6 ${panelClass}`}>
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select
              value={form.template}
              onValueChange={(v) => set("template", v as TotemTemplate)}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TEMPLATES.find((t) => t.value === form.template)?.hint}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Base de color</Label>
            <Select
              value={form.theme}
              onValueChange={(v) => set("theme", v as MyTotemSettings["theme"])}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {BASES.find((b) => b.value === form.theme)?.hint}. Manda en el menú, el carrito y el
              checkout, no solo en la portada.
            </p>
          </div>

          <ImageUploadField
            id="hero"
            label="Imagen de portada"
            value={form.heroImageUrl}
            onChange={(url) => set("heroImageUrl", url)}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="eyebrow">Volanta</Label>
              <Input
                id="eyebrow"
                value={form.eyebrow}
                onChange={(e) => set("eyebrow", e.target.value)}
                placeholder="Autoservicio premium"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={business.name}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleAccent">Segunda línea (en color)</Label>
              <Input
                id="titleAccent"
                value={form.titleAccent}
                onChange={(e) => set("titleAccent", e.target.value)}
                placeholder="PEPE"
                className="h-11"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="subtitle">Bajada</Label>
              <Input
                id="subtitle"
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Tocá la pantalla y armá tu pedido en segundos."
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta">Texto del botón</Label>
              <Input
                id="cta"
                value={form.ctaLabel}
                onChange={(e) => set("ctaLabel", e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">Color de acento</Label>
              <div className="flex gap-2">
                <Input
                  id="accent"
                  type="color"
                  value={form.accentColor || "#e11d2a"}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-11 w-16 cursor-pointer p-1"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  placeholder="#e11d2a"
                  className="h-11 flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="badge1">Distintivo 1</Label>
              <Input
                id="badge1"
                value={form.badge1}
                onChange={(e) => set("badge1", e.target.value)}
                placeholder="Listo en 5 min"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="badge2">Distintivo 2</Label>
              <Input
                id="badge2"
                value={form.badge2}
                onChange={(e) => set("badge2", e.target.value)}
                placeholder="Pago en caja"
                className="h-11"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="h-12 gap-2 px-8 font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar portada
          </Button>
        </form>

        <div className={`space-y-4 p-6 ${panelClass}`}>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold">Vista previa</h3>
          </div>
          <PreviewFrame className="rounded-2xl border border-white/10">
            <TotemHome data={preview} />
          </PreviewFrame>
          <p className="text-xs text-muted-foreground">
            Los cambios se reflejan al instante, pero se aplican al tótem recién cuando guardás.
          </p>
        </div>
      </div>
    </div>
  );
}
