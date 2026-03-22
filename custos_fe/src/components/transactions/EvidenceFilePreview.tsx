"use client";

import { useEffect, useState } from "react";
import { getCustosAuthHeaders } from "@/lib/api/client";
import { ImageOff } from "lucide-react";

/**
 * Loads invoice evidence via authenticated GET and shows an image preview when Content-Type is image/*.
 */
export function EvidenceFilePreview({ fileId, filename }: { fileId: string; filename?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "not_image">("loading");

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoice/file/${encodeURIComponent(fileId)}`, {
          headers: { ...getCustosAuthHeaders() },
          credentials: "include",
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const type = blob.type || res.headers.get("content-type") || "";
        if (cancelled) return;
        if (!type.startsWith("image/")) {
          setState("not_image");
          return;
        }
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setMime(type);
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  if (state === "loading") {
    return (
      <div className="mt-2 h-40 w-full max-w-md animate-pulse rounded-md border border-border bg-muted/40" />
    );
  }
  if (state === "error") {
    return (
      <p className="mt-2 flex items-center gap-2 text-caption text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" />
        Could not load file preview (sign in or check that the file still exists).
      </p>
    );
  }
  if (state === "not_image") {
    return (
      <p className="mt-2 text-caption text-muted-foreground">
        No image preview for this file type; download the original from your uploads if needed.
      </p>
    );
  }
  if (!objectUrl) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-muted/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={objectUrl}
        alt={filename ? `Invoice evidence: ${filename}` : "Invoice evidence"}
        className="max-h-80 w-full max-w-md object-contain object-left"
      />
      {mime && <p className="border-t border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">{mime}</p>}
    </div>
  );
}
