import type { WorkspaceFundingPreference } from "@/lib/api/workspace";

/** Explains workspace funding preference on the wallet screen — all rails remain available. */
export function FundingPreferenceHint({ preference }: { preference: WorkspaceFundingPreference }) {
  if (preference === "BOTH") return null;

  if (preference === "BALANCE_FIRST") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Balance-first.</span> You prefer covering spend from
        pre-funded balance. Top up before heavy agent use; <strong className="text-foreground">Add funds</strong>{" "}
        still offers every enabled rail.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Card-at-spend.</span> When a flow supports it, you prefer charging
      a card at payment time. You can still top up anytime — <strong className="text-foreground">Add funds</strong>{" "}
      does not turn off any rail.
    </div>
  );
}
