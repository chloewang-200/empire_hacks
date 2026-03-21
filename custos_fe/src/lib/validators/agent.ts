import { z } from "zod";

export const agentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(500).optional(),
  /** Optional; defaults to `custom` when connecting your own agent. */
  templateType: z.string().optional(),
  assignedWalletId: z.string().min(1, "Wallet is required"),
  role: z.enum(["viewer", "requester", "approver", "admin"]),
  capabilities: z.array(z.string()),
  status: z.enum(["active", "disabled", "paused", "needs_setup"]),
  callbackUrl: z.string().url().optional().or(z.literal("")),
  monthlyAllowance: z.number().min(0).optional(),
  dailySpendLimit: z.number().min(0).optional(),
  approvalThreshold: z.number().min(0).optional(),
  maxTransactionAmount: z.number().min(0).optional(),
  requireApprovedPayee: z.boolean().optional(),
  vendorAllowlist: z.array(z.string()),
  vendorDenylist: z.array(z.string()),
  restrictedVendors: z.array(z.string()),
  allowedCategories: z.array(z.string()),
  /** Applied to both allowed payout rails and allowed payment methods on the agent. */
  allowedRails: z.array(z.string()),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
