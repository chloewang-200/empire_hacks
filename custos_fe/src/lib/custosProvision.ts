/**
 * Server-only: create/update user in custos_be + default wallet/agents (internal bootstrap).
 */
export async function provisionCustosUser(profile: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<void> {
  const email = profile.email;
  if (!email) return;

  const base =
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[custos] Set CUSTOS_API_URL (or NEXT_PUBLIC_API_URL) to provision wallets/agents on sign-in."
      );
    }
    return;
  }

  const secret = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
  const res = await fetch(`${base}/api/internal/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({
      email,
      name: profile.name ?? undefined,
      image: profile.image ?? undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[custos] bootstrap failed:", res.status, text);
  }
}
