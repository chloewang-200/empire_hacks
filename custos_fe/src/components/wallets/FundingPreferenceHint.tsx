import type { WorkspaceFundingPreference } from "@/lib/api/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { fundingPreferenceLabel, fundingPreferenceSubtitle } from "@/lib/fundingPreference";

export function FundingPreferenceHint({
  preference,
}: {
  preference: WorkspaceFundingPreference;
}) {
  return (
    <Card className="border-border bg-muted/30">
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-foreground">
          Funding preference: {fundingPreferenceLabel(preference)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fundingPreferenceSubtitle(preference)}
        </p>
      </CardContent>
    </Card>
  );
}
