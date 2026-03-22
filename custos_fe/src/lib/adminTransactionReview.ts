type ReviewReasonTone = "default" | "warning" | "destructive" | "secondary";

interface ReviewableTransaction {
  status?: string | null;
  policyResult?: string | null;
  reviewState?: string | null;
  riskFlags?: string[] | null;
}

export interface ReviewReason {
  id: string;
  label: string;
  description: string;
  tone: ReviewReasonTone;
}

const POLICY_REASON_MAP: Record<string, Omit<ReviewReason, "id">> = {
  needs_manual_approval: {
    label: "Manual approval required",
    description: "Wallet policy sent this transaction to a human reviewer before execution.",
    tone: "warning",
  },
  missing_proof: {
    label: "Missing evidence",
    description: "The request does not include the proof or attachments needed for an audit-ready approval.",
    tone: "destructive",
  },
  payee_not_matched: {
    label: "Unapproved vendor",
    description: "The vendor did not match a pre-approved payee, so the purchase needs human confirmation.",
    tone: "destructive",
  },
  over_limit: {
    label: "Over policy limit",
    description: "The spend amount exceeded a configured budget or threshold and must be reviewed manually.",
    tone: "destructive",
  },
  vendor_restricted: {
    label: "Restricted vendor",
    description: "The vendor matched a restricted entry in the wallet or agent controls.",
    tone: "destructive",
  },
  category_not_allowed: {
    label: "Category not allowed",
    description: "The purchase category fell outside the wallet's allowed spend categories.",
    tone: "destructive",
  },
  insufficient_balance: {
    label: "Insufficient balance",
    description: "The wallet did not have enough funds to support the transaction as requested.",
    tone: "warning",
  },
};

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

export function getTransactionReviewReasons(
  transaction: ReviewableTransaction
): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (transaction.status === "pending_review") {
    reasons.push({
      id: "status-pending-review",
      label: "Queued for second check",
      description: "Execution paused until an admin verifies the request and records a decision.",
      tone: "warning",
    });
  }

  if (transaction.status === "blocked") {
    reasons.push({
      id: "status-blocked",
      label: "Blocked before execution",
      description: "A policy gate stopped the transaction and it now needs a manual override or rejection.",
      tone: "destructive",
    });
  }

  if (transaction.policyResult && POLICY_REASON_MAP[transaction.policyResult]) {
    reasons.push({
      id: `policy-${transaction.policyResult}`,
      ...POLICY_REASON_MAP[transaction.policyResult],
    });
  }

  for (const flag of transaction.riskFlags ?? []) {
    reasons.push({
      id: `risk-${flag}`,
      label: humanize(flag),
      description: "The agent emitted this risk signal for human review before money moves.",
      tone: "secondary",
    });
  }

  if (
    reasons.length === 0 &&
    transaction.reviewState &&
    transaction.reviewState !== "approved"
  ) {
    reasons.push({
      id: `review-${transaction.reviewState}`,
      label: humanize(transaction.reviewState),
      description: "This transaction has an open manual review state and should be checked by an admin.",
      tone: transaction.reviewState === "rejected" ? "destructive" : "warning",
    });
  }

  return reasons;
}

export function transactionNeedsAdminReview(transaction: ReviewableTransaction) {
  return getTransactionReviewReasons(transaction).length > 0;
}
