"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAgent } from "@/lib/api/agents";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentFormDialog } from "@/components/agents/AgentFormDialog";

export default function AgentEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [dialogOpen, setDialogOpen] = useState(true);
  const { data: agent, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => getAgent(id),
  });

  if (isLoading || !agent) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/agents/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-heading-1">Edit agent</h1>
      </div>
      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) router.push(`/agents/${id}`);
        }}
        agentId={id}
        defaultValues={{
          name: agent.name,
          description: agent.description ?? "",
          templateType: agent.templateType,
          assignedWalletId: agent.assignedWalletId,
          role: agent.role,
          capabilities: agent.capabilities?.map((c) => c.id) ?? [],
          status: agent.status,
          monthlyAllowance: agent.monthlyAllowance ?? undefined,
          dailySpendLimit: agent.dailySpendLimit ?? undefined,
          approvalThreshold: agent.approvalThreshold ?? undefined,
          maxTransactionAmount: agent.maxTransactionAmount ?? undefined,
          requireApprovedPayee: agent.requireApprovedPayee ?? false,
          auditPolicyText: agent.settings?.auditPolicyText ?? "",
          vendorAllowlist: agent.vendorAllowlist ?? [],
          vendorDenylist: agent.vendorDenylist ?? [],
          restrictedVendors: agent.restrictedVendors ?? [],
          allowedCategories: agent.allowedCategories ?? [],
          allowedRails: Array.from(
            new Set([...(agent.allowedPayoutRails ?? []), ...(agent.allowedPaymentMethods ?? [])])
          ),
        }}
      />
    </div>
  );
}
