import type { ApprovedPayee } from "@prisma/client";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve vendor string to an active approved payee using display name, legal name, or aliases.
 */
export function matchPayeeByVendor(payees: ApprovedPayee[], vendor: string | undefined): ApprovedPayee | null {
  if (!vendor?.trim()) return null;
  const v = norm(vendor);
  for (const p of payees) {
    if (!p.active) continue;
    if (norm(p.displayName) === v || (p.legalName && norm(p.legalName) === v)) return p;
    if (norm(p.displayName).includes(v) || v.includes(norm(p.displayName))) return p;
    if (p.legalName && (norm(p.legalName).includes(v) || v.includes(norm(p.legalName)))) return p;
    try {
      const aliases = JSON.parse(p.aliasesJson) as unknown;
      if (Array.isArray(aliases)) {
        for (const a of aliases) {
          if (typeof a !== "string") continue;
          const an = norm(a);
          if (an === v || v.includes(an) || an.includes(v)) return p;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
