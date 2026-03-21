import type { InvoiceExtractionResult } from "@/lib/types";
import { apiPost } from "./client";

export async function uploadInvoice(file: File): Promise<{ fileId: string; url?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const baseUrl = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/invoice/upload`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function extractInvoice(fileId: string): Promise<InvoiceExtractionResult> {
  return apiPost<InvoiceExtractionResult>("/api/invoice/extract", { fileId });
}
