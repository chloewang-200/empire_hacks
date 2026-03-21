import { agentService } from "./agents";
import { transactionService } from "./transactions";
import { vendorService } from "./vendors";
import type {
  TransactionValidationContext,
  TransactionValidationPreview,
  TransactionValidationResult,
} from "./types";

export const validationService = {
  async validateTransaction(transactionId: string): Promise<TransactionValidationResult> {
    const context = await this.buildTransactionValidationContext(transactionId);
    const preview = await this.previewTransactionValidation({
      clientId: context.transaction.clientId,
      vendorId: context.transaction.vendorId,
      agentId: context.transaction.agentId ?? undefined,
      amount: context.transaction.amount,
      currency: context.transaction.currency,
      paymentMethod: context.transaction.paymentMethod,
      requestedPaymentDatetime: context.transaction.requestedPaymentDatetime ?? undefined,
    });

    return {
      transactionId,
      valid: preview.valid,
      result: preview.result,
      paymentStatus: context.transaction.paymentStatus,
      approvalStatus: context.transaction.approvalStatus,
      humanApprovalRequired: preview.humanApprovalRequired,
      triggeredRules: preview.triggeredRules,
      complianceFlags: preview.complianceFlags,
      evaluatedAt: new Date().toISOString(),
    };
  },

  async buildTransactionValidationContext(
    transactionId: string
  ): Promise<TransactionValidationContext> {
    const transaction = await transactionService.getTransaction(transactionId);
    const vendor = await vendorService.getVendor(transaction.vendorId).catch(() => null);
    const agent = transaction.agentId
      ? await agentService.getAgent(transaction.agentId).catch(() => null)
      : null;

    return { transaction, vendor, agent };
  },

  async previewTransactionValidation(input: {
    clientId: string;
    vendorId: string;
    agentId?: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    requestedPaymentDatetime?: string;
  }): Promise<TransactionValidationPreview> {
    const vendor = await vendorService.getVendor(input.vendorId).catch(() => null);
    const agent = input.agentId
      ? await agentService.getAgent(input.agentId).catch(() => null)
      : null;

    const triggeredRules: TransactionValidationPreview["triggeredRules"] = [];
    const complianceFlags: string[] = [];

    if (vendor?.rules.maxAmountPerTransaction && input.amount > vendor.rules.maxAmountPerTransaction) {
      triggeredRules.push({
        source: "vendor",
        rule: "max_amount_per_transaction",
        message: "Amount exceeds vendor max transaction amount.",
      });
      complianceFlags.push("vendor_max_exceeded");
    }

    if (agent && input.amount > agent.maxTransactionAmount) {
      triggeredRules.push({
        source: "agent",
        rule: "max_transaction_amount",
        message: "Amount exceeds agent max transaction amount.",
      });
      complianceFlags.push("agent_max_exceeded");
    }

    if (agent && !agent.allowedPaymentMethods.includes(input.paymentMethod as never)) {
      triggeredRules.push({
        source: "agent",
        rule: "allowed_payment_methods",
        message: "Payment method is not allowed for this agent.",
      });
      complianceFlags.push("payment_method_not_allowed");
    }

    if (agent && agent.vendorDenylist.includes(input.vendorId)) {
      triggeredRules.push({
        source: "agent",
        rule: "vendor_denylist",
        message: "Vendor is on the agent denylist.",
      });
      complianceFlags.push("vendor_blocked");
    }

    const humanApprovalRequired =
      Boolean(vendor?.rules.requiresHumanApprovalAbove && input.amount > vendor.rules.requiresHumanApprovalAbove) ||
      Boolean(agent && input.amount > agent.approvalThreshold);

    const result =
      complianceFlags.some((flag) => flag.includes("exceeded") || flag === "vendor_blocked")
        ? "blocked_by_rules"
        : humanApprovalRequired
          ? "needs_review"
          : "approved_by_rules";

    return {
      valid: result !== "blocked_by_rules",
      result,
      humanApprovalRequired,
      triggeredRules,
      complianceFlags,
    };
  },
};
