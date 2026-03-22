import { NextResponse } from "next/server";
import type { AgentTemplate } from "@/lib/types";

const TEMPLATES: AgentTemplate[] = [
  {
    id: "event_production",
    name: "Event production payouts",
    description:
      "Paste event budgets and vendor rosters; draft many payables, then route each line through Custos policy, risk, and payouts.",
    status: "available",
  },
  {
    id: "invoice",
    name: "Invoice Agent",
    description: "Turn invoice uploads into payment requests. Upload images or PDFs; extract vendor, amount, due date; submit for policy evaluation.",
    status: "available",
  },
  {
    id: "procurement",
    name: "Procurement Agent",
    description: "Request and track procurement spend against wallet policies.",
    status: "coming_soon",
  },
  {
    id: "travel",
    name: "Travel Agent",
    description: "Book travel and submit expenses for approval.",
    status: "coming_soon",
  },
  {
    id: "vendor_payout",
    name: "Vendor Payout Agent",
    description: "Submit vendor payouts with supporting documentation.",
    status: "coming_soon",
  },
  {
    id: "reimbursement",
    name: "Reimbursement Agent",
    description: "Handle employee reimbursement requests and receipts.",
    status: "coming_soon",
  },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}
