/** Payout / payment rails — same ids as backend & payee directory. */
export const AGENT_PAYOUT_RAILS = [
  { value: "merchant_card", label: "Card", description: "Card / merchant of record" },
  { value: "stripe_connect", label: "Stripe Connect", description: "Payout to connected account" },
  { value: "ach", label: "ACH", description: "Bank ACH" },
  { value: "venmo_p2p", label: "Venmo", description: "Venmo P2P (manual if not automated)" },
  { value: "wire", label: "Wire", description: "Wire transfer" },
  { value: "bank_transfer", label: "Bank transfer", description: "Generic bank transfer" },
  { value: "paypal", label: "PayPal", description: "PayPal" },
  { value: "other", label: "Other", description: "Other / unspecified" },
] as const;

/** Suggested spend categories — agents can still use custom tags in UI. */
export const AGENT_SPEND_CATEGORY_PRESETS = [
  { value: "software", label: "Software & SaaS" },
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals & entertainment" },
  { value: "office", label: "Office & supplies" },
  { value: "professional_services", label: "Professional services" },
  { value: "marketing", label: "Marketing & ads" },
  { value: "events_production", label: "Events & production" },
  { value: "healthcare_ops", label: "Healthcare operations" },
  { value: "legal_compliance", label: "Legal & compliance" },
  { value: "payroll_benefits", label: "Payroll & benefits" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
] as const;

/** Standard risk flags agents can send via API; some force human review. */
export const AGENT_RISK_FLAG_PRESETS = [
  { value: "human_review", label: "Human review", description: "Send to review queue" },
  { value: "escalate", label: "Escalate", description: "Treat as escalation" },
  { value: "new_vendor", label: "New vendor", description: "First payment to this counterparty" },
  { value: "high_value", label: "High value", description: "Unusually large amount" },
  { value: "policy_ambiguous", label: "Policy ambiguous", description: "Rule application unclear" },
  { value: "document_quality_low", label: "Low doc quality", description: "Weak evidence / OCR" },
] as const;
