import { redirect } from "next/navigation";

export default async function AdminUserDetailRedirectPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/admin/clients/${clientId}`);
}
