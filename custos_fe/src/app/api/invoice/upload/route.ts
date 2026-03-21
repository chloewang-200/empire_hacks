import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "No file" }, { status: 400 });
    }
    // TODO: Store file in blob/store and return ID
    const fileId = `inv_${Date.now()}_${file.name.replace(/\s/g, "_")}`;
    return NextResponse.json({ fileId, url: undefined });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
