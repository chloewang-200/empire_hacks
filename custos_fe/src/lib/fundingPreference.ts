import type { WorkspaceFundingPreference } from "@/lib/api/workspace";

export function fundingPreferenceLabel(preference: WorkspaceFundingPreference): string {
  switch (preference) {
    case "BALANCE_FIRST":
      return "Pre-funded balance";
    case "CARD_AT_SPEND":
      return "Card at spend";
    default:
      return "Flexible";
  }
}

/** Copy for Settings + wallet / Add funds — preference does not disable any rail. */
export function fundingPreferenceSubtitle(p: WorkspaceFundingPreference | undefined): string {
  if (p === "BALANCE_FIRST") {
    return "Top up this wallet so balance covers spend. Every rail (card, treasury code, …) stays available.";
  }
  if (p === "CARD_AT_SPEND") {
    return "You prefer charging a card when a payment runs; you can still top up here with any rail.";
  }
  return "Top up this wallet — card, treasury credit, or other rails.";
}
