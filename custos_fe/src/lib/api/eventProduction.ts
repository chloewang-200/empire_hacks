import type { EventProductionPlanResult } from "@/lib/types";

function custosAuthHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = sessionStorage.getItem("custos_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function planEventProduction(body: {
  eventName?: string;
  notes?: string;
  documentsText: string;
}): Promise<EventProductionPlanResult> {
  const res = await fetch("/api/event-production/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...custosAuthHeader(),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Plan failed");
  }
  return res.json() as Promise<EventProductionPlanResult>;
}
