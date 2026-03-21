import { NextResponse } from "next/server";
import type { InvoiceExtractionResult } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileId = body?.fileId as string | undefined;
    if (!fileId) {
      return NextResponse.json({ message: "fileId required" }, { status: 400 });
    }
    // TODO: Call OCR/extraction service; return typed result
    const result: InvoiceExtractionResult = {
      vendor: "Acme Corp",
      invoiceNumber: "INV-2024-001",
      amount: 1250.0,
      dueDate: "2024-04-15",
      memo: "Q1 services",
      confidence: 0.92,
      sourceFileId: fileId,
    };
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Extract failed" },
      { status: 500 }
    );
  }
}
