import type { Transaction } from "@/lib/types";

/** Policy outcomes that mean "held for human review" — after approve, we show/treat as cleared. */
const REVIEW_HELD_RESULTS = new Set([
  "needs_manual_approval",
  "payee_not_matched",
  "missing_proof",
]);

/**
 * Policy badge label/variant after human review may differ from stored `policyResult`
 * (submission-time reason). Backend also moves some rows to `within_policy` on approve.
 */
export function effectivePolicyDisplay(
  tx: Pick<Transaction, "policyResult" | "reviewState" | "status">
): { result: string; subtitle?: string } | null {
  const pr = tx.policyResult ?? "";
  if (
    tx.reviewState === "approved" &&
    (tx.status === "approved" || tx.status === "settled") &&
    pr &&
    REVIEW_HELD_RESULTS.has(pr)
  ) {
    return {
      result: "cleared_by_human_review",
      subtitle: `Originally: ${pr.replace(/_/g, " ")}`,
    };
  }
  if (!pr) return null;
  return { result: pr };
}

export function payoutStatusLabel(
  tx: Pick<Transaction, "status" | "payoutStatus" | "payoutError">
): string | null {
  const ps = tx.payoutStatus?.trim();
  if (tx.status === "settled") return "Payment: completed";
  if (tx.status === "blocked" || tx.status === "canceled") return null;
  if (tx.status !== "approved" && tx.status !== "pending_review") return null;

  if (!ps || ps === "not_attempted")
    return tx.status === "approved" ? "Payment: not sent yet (auto-payout off or pending)" : null;
  if (ps === "skipped") return "Payment: skipped (e.g. no Connect account / rail)";
  if (ps === "processing") return "Payment: processing";
  if (ps === "succeeded") return "Payment: succeeded";
  if (ps === "failed")
    return tx.payoutError ? `Payment: failed — ${tx.payoutError}` : "Payment: failed";
  if (ps === "unsupported_rail") return "Payment: rail not supported for auto-payout";
  return `Payment: ${ps.replace(/_/g, " ")}`;
}
