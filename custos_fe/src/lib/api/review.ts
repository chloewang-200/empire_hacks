import type { ReviewItem } from "@/lib/types";
import { apiRelativeGet } from "./client";

export async function getReviewQueue(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ data: ReviewItem[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  const q = search.toString();
  return apiRelativeGet<{ data: ReviewItem[]; total: number }>(`/api/review-queue${q ? `?${q}` : ""}`);
}
