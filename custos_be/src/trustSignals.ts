import type { PolicyOutcome } from "./policy.js";

function riskReviewThreshold(): number {
  const n = parseInt(process.env.CUSTOS_RISK_SCORE_REVIEW_THRESHOLD ?? "65", 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 65;
}

function modelConfidenceReviewMax(): number {
  const n = parseFloat(process.env.CUSTOS_MODEL_CONFIDENCE_REVIEW_MAX ?? "0.75");
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.75;
}

export type TrustSignalInput = {
  riskScore?: number | null;
  riskFlags?: string[] | null;
  modelConfidence?: number | null;
};

export function evaluateTrustEscalation(input: TrustSignalInput): {
  escalate: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const thr = riskReviewThreshold();
  if (input.riskScore != null && input.riskScore >= thr) {
    reasons.push(`Risk score ${input.riskScore} ≥ review threshold (${thr})`);
  }
  const flags = input.riskFlags ?? [];
  for (const f of flags) {
    const fl = f.toLowerCase();
    if (fl === "human_review" || fl === "escalate") {
      reasons.push(`Risk flag: ${f}`);
      break;
    }
  }
  const confMax = modelConfidenceReviewMax();
  if (input.modelConfidence != null && input.modelConfidence < confMax) {
    reasons.push(`Model confidence ${input.modelConfidence} < ${confMax} (agent-declared)`);
  }
  return { escalate: reasons.length > 0, reasons };
}

export function formatTrustPayloadSummary(opts: {
  riskScore?: number | null;
  riskFlags?: string[] | null;
  citedRulesCount: number;
  hasAgentDecision: boolean;
  evidenceCount: number;
}): string {
  const parts: string[] = [];
  if (opts.riskScore != null) parts.push(`riskScore=${opts.riskScore}`);
  if (opts.riskFlags?.length) parts.push(`flags=[${opts.riskFlags.join(", ")}]`);
  if (opts.citedRulesCount > 0) parts.push(`citedRules=${opts.citedRulesCount}`);
  if (opts.hasAgentDecision) parts.push("agentDecision=present");
  if (opts.evidenceCount > 0) parts.push(`evidenceItems=${opts.evidenceCount}`);
  return parts.length ? parts.join("; ") : "";
}

export type TrustLayerBody = {
  riskScore?: number | null;
  riskFlags?: string[] | null;
  agentDecision?: { summary?: string; modelConfidence?: number | null } | null;
  citedRules?: unknown[] | null;
  evidence?: unknown[] | null;
};

/** Append trust evaluation to policy checks; may force review when policy would auto-approve. */
export function applyTrustLayerToOutcome(
  outcome: PolicyOutcome,
  body: TrustLayerBody
): PolicyOutcome {
  const modelConf = body.agentDecision?.modelConfidence;
  const trust = evaluateTrustEscalation({
    riskScore: body.riskScore ?? null,
    riskFlags: body.riskFlags ?? null,
    modelConfidence: modelConf ?? null,
  });

  const trustSummary = formatTrustPayloadSummary({
    riskScore: body.riskScore,
    riskFlags: body.riskFlags ?? undefined,
    citedRulesCount: body.citedRules?.length ?? 0,
    hasAgentDecision: Boolean(body.agentDecision?.summary?.trim()),
    evidenceCount: body.evidence?.length ?? 0,
  });

  if (trust.escalate) {
    if (outcome.status === "approved" && outcome.policyResult === "within_policy") {
      return {
        ...outcome,
        policyResult: "needs_manual_approval",
        status: "pending_review",
        reviewState: "pending",
        policyEvaluation: [
          ...outcome.policyEvaluation,
          {
            check: "Trust & risk signals",
            result: "fail",
            detail: `Human review required: ${trust.reasons.join("; ")}`,
          },
        ],
      };
    }
    return {
      ...outcome,
      policyEvaluation: [
        ...outcome.policyEvaluation,
        {
          check: "Trust & risk signals",
          result: "pass",
          detail: `Logged (did not override outcome): ${trust.reasons.join("; ")}`,
        },
      ],
    };
  }

  if (trustSummary) {
    return {
      ...outcome,
      policyEvaluation: [
        ...outcome.policyEvaluation,
        {
          check: "Trust & audit payload",
          result: "pass",
          detail: trustSummary,
        },
      ],
    };
  }

  return outcome;
}
