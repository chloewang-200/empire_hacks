import { NextResponse } from "next/server";

function backendBase(): string | null {
  const base =
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  return base || null;
}

/** Proxies authenticated invoice file bytes from custos_be (for &lt;img&gt; / previews). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId || !/^inv_\d+$/.test(fileId)) {
    return NextResponse.json({ message: "Invalid file id" }, { status: 400 });
  }
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization");
  let r: Response;
  try {
    r = await fetch(`${base}/api/invoice/file/${encodeURIComponent(fileId)}`, {
      headers: auth ? { Authorization: auth } : {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cannot reach custos_be";
    return NextResponse.json({ message }, { status: 503 });
  }
  if (!r.ok) {
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
    });
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") ?? "application/octet-stream";
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "private, max-age=300",
    },
  });
}
