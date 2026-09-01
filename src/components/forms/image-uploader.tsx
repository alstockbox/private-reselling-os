"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";

export function ImageUploader({ name = "imageUrl" }: { name?: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setError("");
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/images", { method: "POST", body: formData });
      const json = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !json.url) throw new Error(json.error ?? "Uppladdningen misslyckades.");
      setUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uppladdningen misslyckades.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className="relative overflow-hidden rounded-[8px] border border-[var(--border)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Förhandsvisning" className="aspect-square w-full object-cover" />
          <button
            type="button"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-[8px] bg-white text-[var(--primary)] shadow"
            onClick={() => setUrl("")}
            aria-label="Ta bort bild"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <label className="grid min-h-52 cursor-pointer place-items-center rounded-[8px] border border-dashed border-[var(--border)] bg-white/80 p-6 text-center">
          <span className="grid gap-2 justify-items-center text-[var(--primary-strong)]">
            {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            <span className="font-black">{pending ? "Laddar upp..." : "Lägg till bild"}</span>
            <span className="text-sm text-[var(--muted)]">Foto eller bildbibliotek</span>
          </span>
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      )}
      {error ? <p className="rounded-[8px] bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
