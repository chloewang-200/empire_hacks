import { NextResponse } from "next/server";
import type { ReviewItem } from "@/lib/types";

export async function GET() {
  try {
    const data: ReviewItem[] = [];
    return NextResponse.json({ data, total: data.length });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
