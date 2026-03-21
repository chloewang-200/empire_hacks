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
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
