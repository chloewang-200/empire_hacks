import type { InvoiceExtractionResult } from "@/lib/types";

function custosAuthHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = sessionStorage.getItem("custos_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Same-origin proxy stores files on custos_be when CUSTOS_API_URL is set on the Next server. */
export async function uploadInvoice(file: File): Promise<{ fileId: string; url?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/invoice/upload", {
    method: "POST",
    body: formData,
    headers: custosAuthHeader(),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Upload failed");
  }
  return res.json();
}

export async function extractInvoice(fileId: string): Promise<InvoiceExtractionResult> {
  const res = await fetch("/api/invoice/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...custosAuthHeader(),
    },
    body: JSON.stringify({ fileId }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<InvoiceExtractionResult>;
}
