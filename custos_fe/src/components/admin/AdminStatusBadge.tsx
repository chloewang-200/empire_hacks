import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const clientVariants: Record<string, "default" | "muted" | "warning"> = {
  active: "default",
  under_review: "warning",
  disabled: "muted",
  inactive: "muted",
};

const agentVariants: Record<string, "default" | "warning" | "muted"> = {
  active: "default",
  paused: "warning",
  revoked: "muted",
  deleted: "muted",
  disabled: "muted",
  needs_setup: "warning",
};

const paymentVariants: Record<
  string,
  "warning" | "success" | "secondary" | "destructive" | "muted"
> = {
  pending: "warning",
  scheduled: "secondary",
  processing: "secondary",
  paid: "success",
  failed: "destructive",
  cancelled: "muted",
};

const approvalVariants: Record<
  string,
  "secondary" | "warning" | "success" | "destructive"
> = {
  auto_approved: "secondary",
  pending_human_approval: "warning",
  human_approved: "success",
  rejected: "destructive",
};

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

export function AdminClientStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant={clientVariants[status] ?? "secondary"}
      className={cn("capitalize", className)}
    >
      {labelize(status)}
    </Badge>
  );
}

export const AdminUserStatusBadge = AdminClientStatusBadge;
export const CompanyStatusBadge = AdminClientStatusBadge;

export function AdminAgentStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={agentVariants[status] ?? "secondary"} className={cn("capitalize", className)}>
      {labelize(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={paymentVariants[status] ?? "secondary"} className={cn("capitalize", className)}>
      {labelize(status)}
    </Badge>
  );
}

export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={approvalVariants[status] ?? "secondary"} className={cn("capitalize", className)}>
      {labelize(status)}
    </Badge>
  );
}

export function ManualReviewStatusBadge({
  status,
  className,
}: {
  status: "pending" | "verified" | "rejected";
  className?: string;
}) {
  const variant =
    status === "verified"
      ? "success"
      : status === "rejected"
        ? "destructive"
        : "warning";

  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {status === "pending" ? "Pending review" : labelize(status)}
    </Badge>
  );
}
