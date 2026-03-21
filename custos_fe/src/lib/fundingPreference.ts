import type { WorkspaceFundingPreference } from "@/lib/api/workspace";

export function fundingPreferenceLabel(
  preference: WorkspaceFundingPreference
): string {
  switch (preference) {
    case "BALANCE_FIRST":
      return "Pre-funded balance";
    case "CARD_AT_SPEND":
      return "Card at spend";
    default:
      return "Flexible";
  }
}

export function fundingPreferenceSubtitle(
  preference: WorkspaceFundingPreference
): string {
  switch (preference) {
    case "BALANCE_FIRST":
      return "This workspace usually tops up wallets first, then spends from wallet balance.";
    case "CARD_AT_SPEND":
      return "This workspace usually charges a card when spend happens, where supported.";
    default:
      return "This workspace supports either top-ups or card-at-spend depending on the situation.";
  }
}
