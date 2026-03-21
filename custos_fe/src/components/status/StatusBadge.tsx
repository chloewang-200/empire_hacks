"use client";

import { Badge } from "@/components/ui/badge";
import type { AgentStatus, WalletStatus, TransactionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const agentStatusVariant: Record<AgentStatus, "default" | "secondary" | "warning" | "muted"> = {
  active: "default",
  disabled: "muted",
  paused: "warning",
  needs_setup: "secondary",
};

const walletStatusVariant: Record<WalletStatus, "default" | "secondary" | "warning"> = {
  active: "default",
  paused: "warning",
  restricted: "secondary",
};

const transactionStatusVariant: Record<
  TransactionStatus,
  "default" | "success" | "destructive" | "warning" | "muted"
> = {
  approved: "success",
  settled: "success",
  blocked: "destructive",
  canceled: "muted",
  pending_review: "warning",
};

const labels: Record<string, string> = {
  active: "Active",
  disabled: "Disabled",
  paused: "Paused",
  needs_setup: "Needs setup",
  restricted: "Restricted",
  approved: "Approved",
  blocked: "Blocked",
  pending_review: "Pending Review",
  settled: "Settled",
  canceled: "Canceled",
};

export function AgentStatusBadge({ status, className }: { status: AgentStatus; className?: string }) {
  const v = agentStatusVariant[status];
  return (
    <Badge variant={v} className={cn("capitalize", className)}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function WalletStatusBadge({ status, className }: { status: WalletStatus; className?: string }) {
  const v = walletStatusVariant[status];
  return (
    <Badge variant={v} className={cn("capitalize", className)}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function TransactionStatusBadge({
  status,
  className,
}: {
  status: TransactionStatus;
  className?: string;
}) {
  const v = transactionStatusVariant[status];
  return (
    <Badge variant={v} className={cn("capitalize", className)}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function PolicyResultBadge({
  result,
  className,
}: {
  result: string;
  className?: string;
}) {
  const isPass = result === "within_policy";
  const label = result.replace(/_/g, " ");
  return (
    <Badge
      variant={isPass ? "success" : "destructive"}
      className={cn("capitalize", className)}
    >
      {label}
    </Badge>
  );
}
