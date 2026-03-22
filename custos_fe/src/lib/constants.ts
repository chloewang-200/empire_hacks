export const AGENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "paused", label: "Paused" },
  { value: "needs_setup", label: "Needs setup" },
] as const;

export const AGENT_ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "requester", label: "Requester" },
  { value: "approver", label: "Approver" },
  { value: "admin", label: "Admin" },
] as const;

export const AGENT_TEMPLATE_TYPES = [
  { value: "event_production", label: "Event production payouts" },
  { value: "invoice", label: "Invoice Agent" },
  { value: "invoice_chat", label: "Invoice Copilot (chat)" },
  { value: "procurement", label: "Procurement Agent" },
  { value: "travel", label: "Travel Agent" },
  { value: "reimbursement", label: "Reimbursement Agent" },
  { value: "vendor_payout", label: "Vendor Payout Agent" },
  { value: "custom", label: "Custom Agent" },
] as const;

/** Templates shown in “Start from a template” flow (excludes generic custom). */
export const AGENT_STARTER_TEMPLATES = [
  {
    value: "event_production",
    label: "Event production payouts",
    description:
      "Turn budgets and vendor rosters into many governed payout requests — best first template for multi-vendor events.",
  },
  {
    value: "invoice",
    label: "Invoice Agent",
    description: "Upload invoices and submit payment requests with extraction.",
  },
  {
    value: "invoice_chat",
    label: "Invoice Copilot (chat)",
    description:
      "Conversational invoice flow: drop an image, refine fields in chat, then submit the same governed payment request.",
  },
  {
    value: "procurement",
    label: "Procurement Agent",
    description: "Procurement spend against wallet policies.",
  },
  {
    value: "travel",
    label: "Travel Agent",
    description: "Travel bookings and expense submissions.",
  },
  {
    value: "reimbursement",
    label: "Reimbursement Agent",
    description: "Employee reimbursements and receipts.",
  },
  {
    value: "vendor_payout",
    label: "Vendor Payout Agent",
    description: "Vendor payouts with supporting documentation.",
  },
] as const;

export const WALLET_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "restricted", label: "Restricted" },
] as const;

export const APPROVAL_MODES = [
  { value: "auto", label: "Auto" },
  { value: "review", label: "Review" },
  { value: "strict", label: "Strict" },
] as const;

export const TRANSACTION_STATUSES = [
  { value: "approved", label: "Approved" },
  { value: "blocked", label: "Blocked" },
  { value: "pending_review", label: "Pending Review" },
  { value: "settled", label: "Settled" },
  { value: "canceled", label: "Canceled" },
] as const;

export const POLICY_RESULTS = [
  { value: "within_policy", label: "Within policy" },
  { value: "over_limit", label: "Over limit" },
  { value: "vendor_restricted", label: "Vendor restricted" },
  { value: "missing_proof", label: "Missing proof" },
  { value: "needs_manual_approval", label: "Needs manual approval" },
  { value: "category_not_allowed", label: "Category not allowed" },
  { value: "agent_capability_not_allowed", label: "Agent capability not allowed" },
] as const;

export const CATEGORIES = [
  "Software",
  "Travel",
  "Office supplies",
  "Vendor payments",
  "Utilities",
  "Marketing",
  "Professional services",
  "Other",
];
