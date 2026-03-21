"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/**
 * When NEXT_PUBLIC_API_URL points at custos_be, obtain a Custos JWT after Google login
 * and store it for apiFetch Authorization headers.
 */
export function CustosBootstrap() {
  const { data: session, status } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    if (!process.env.NEXT_PUBLIC_API_URL) return;
    if (done.current) return;
    done.current = true;

    void (async () => {
      try {
        const r = await fetch("/api/auth/custos-token", { method: "POST" });
        if (!r.ok) return;
        const data = (await r.json()) as { token?: string };
        if (data.token) {
          sessionStorage.setItem("custos_jwt", data.token);
        }
      } catch {
        done.current = false;
      }
    })();
  }, [status, session]);

  return null;
}
