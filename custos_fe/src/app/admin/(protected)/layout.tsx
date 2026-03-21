import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { authOptions } from "@/lib/auth";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

  // In local dev with auth disabled, allow access without NextAuth.
  if (!authEnabled) {
    return <AdminShell>{children}</AdminShell>;
  }

  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "admin") {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
