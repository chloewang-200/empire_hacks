"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";

const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!authEnabled || status !== "unauthenticated") return;
    router.replace("/login");
  }, [status, router]);

  if (!authEnabled) {
    return <AppShell>{children}</AppShell>;
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
