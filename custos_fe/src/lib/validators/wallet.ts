import { z } from "zod";

export const walletFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  currency: z.string().length(3, "Use 3-letter currency code"),
  balance: z.number().min(0),
  dailyLimit: z.number().min(0).optional(),
  perTransactionLimit: z.number().min(0).optional(),
  allowedCategories: z.array(z.string()),
  allowedVendors: z.string().optional(),
  approvalMode: z.enum(["auto", "review", "strict"]),
  status: z.enum(["active", "paused", "restricted"]),
  notes: z.string().max(1000).optional(),
});

export type WalletFormValues = z.infer<typeof walletFormSchema>;
