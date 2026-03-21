import { NextResponse } from "next/server";

export async function GET() {
  const template = {
    id: "invoice",
    name: "Invoice Agent",
    description: "Turn invoice uploads into payment requests with extraction and policy evaluation.",
    status: "available",
    workflowSteps: [
      "Upload invoice image or PDF",
      "Extract vendor, amount, due date, memo",
      "Review or correct extracted fields",
      "Submit payment request",
      "Receive policy decision (approved / blocked / pending review)",
    ],
  };
  return NextResponse.json(template);
}
