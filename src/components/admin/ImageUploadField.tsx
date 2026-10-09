import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/api/uploads.functions";

type Formato = "image/webp" | "image/jpeg" | "image/png";

/**
 * Lado máximo según dónde se muestra la imagen. Una foto de producto se ve en
 * una tarjeta y un logo en un círculo chico: guardarlas a 1600 px es pagar en
 * la base píxeles que nadie ve. La portada sí ocupa la pantalla entera.
 */
export const LADO_MAXIMO = { foto: 900, logo: 512, portada: 1600 } as const;

/** ¿Algún píxel es (semi)transparente? Decide PNG o JPEG cuando no hay WebP. */
function tieneTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

// Redimensiona y recomprime en el navegador: una foto de celular de varios MB
// termina pesando decenas de KB, que es lo que guardamos en la base.
//
// Safari no sabe codificar WebP desde un canvas: `toDataURL("image/webp")`
// devuelve en silencio un PNG sin pérdida, que pesa diez veces más (así entró
// un logo de 463 KB etiquetado como WebP). Por eso se mira qué formato salió de
// verdad y, si no es WebP, se usa JPEG, o PNG cuando la imagen tiene
// transparencia (un logo recortado sobre JPEG quedaría con fondo negro).
function compress(file: File, maxSide: number): Promise<{ mimeType: Formato; data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);

      let dataUrl = canvas.toDataURL("image/webp", 0.8);
      let mimeType: Formato = "image/webp";
      if (!dataUrl.startsWith("data:image/webp")) {
        mimeType = tieneTransparencia(ctx, canvas.width, canvas.height)
          ? "image/png"
          : "image/jpeg";
        dataUrl = canvas.toDataURL(mimeType, 0.8);
      }
      resolve({ mimeType, data: dataUrl.slice(dataUrl.indexOf(",") + 1) });
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}

export function ImageUploadField({
  id,
  label,
  value,
  onChange,
  maxSide = LADO_MAXIMO.foto,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Lado máximo en px; ver `LADO_MAXIMO`. */
  maxSide?: number;
}) {
  const doUpload = useServerFn(uploadImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await doUpload({ data: await compress(file, maxSide) });
      onChange(url);
      toast.success("Imagen subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      {value && (
        <div className="relative w-fit">
          <img
            src={value}
            alt=""
            className="h-28 w-48 rounded-xl border border-white/10 object-cover"
          />
          <button
            type="button"
            aria-label="Quitar imagen"
            onClick={() => onChange("")}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... o subí un archivo"
          className="h-11 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="h-11 shrink-0 gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Subir
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o AVIF. Hasta 5 MB.</p>
    </div>
  );
}
