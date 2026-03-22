"use client";

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { X } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AGENT_PAYOUT_RAILS,
  AGENT_SPEND_CATEGORY_PRESETS,
} from "@/lib/agentSpendConstants";
import type { AgentFormValues } from "@/lib/validators/agent";
import { compileAuditPolicyText } from "@/lib/auditPolicy";
import { cn } from "@/lib/utils";

function toggleInList(list: string[], value: string): string[] {
  const i = list.indexOf(value);
  if (i >= 0) return list.filter((_, idx) => idx !== i);
  return [...list, value];
}

function TagListField({
  value,
  onChange,
  label,
  description,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  description?: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && <p className="text-caption text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-2 min-h-[42px]">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
            {tag}
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          className="min-w-[140px] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 h-8"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const raw = (e.target as HTMLInputElement).value.trim();
            if (!raw) return;
            if (!value.includes(raw)) onChange([...value, raw]);
            (e.target as HTMLInputElement).value = "";
          }}
        />
      </div>
      <p className="text-caption text-muted-foreground">Press Enter to add each entry.</p>
    </div>
  );
}

export function AgentGovernanceStep({ control }: { control: Control<AgentFormValues> }) {
  const auditPolicyText = useWatch({
    control,
    name: "auditPolicyText",
  });
  const compiledAuditPolicy = compileAuditPolicyText(auditPolicyText);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Spend limits</h3>
        <p className="text-caption text-muted-foreground mt-1">
          Caps for this agent only. Wallet limits still apply on top.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="monthlyAllowance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly cap</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="No cap"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="dailySpendLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="No cap"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="maxTransactionAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max per transaction</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="No max"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="approvalThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Human review above</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="None"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <FormField
        control={control}
        name="requireApprovedPayee"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border bg-card p-4">
            <FormControl>
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
            </FormControl>
            <div className="space-y-1">
              <FormLabel className="text-sm font-medium">Require approved payee</FormLabel>
              <p className="text-caption text-muted-foreground">
                Only pay when <code className="text-xs">payeeId</code> or vendor matches your Payees directory;
                otherwise send to review.
              </p>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="auditPolicyText"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Auditor instructions</FormLabel>
            <FormControl>
              <Textarea
                rows={5}
                value={field.value ?? ""}
                onChange={field.onChange}
                className="resize-none text-sm"
                placeholder={`Describe the checks in plain English.\n\nExample: Flag duplicate invoices by vendor + invoice number + amount. Review unmatched vendors. Escalate confidence below 85%. Require citations and invoice evidence. Review rail mismatch and missing due date.`}
              />
            </FormControl>
            <p className="text-caption text-muted-foreground">
              Custos compiles this into deterministic review checks for invoice and AP-style requests.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Compiled audit checks</h3>
            <p className="text-caption text-muted-foreground mt-1">
              What the control layer will actually enforce from the verbal policy.
            </p>
          </div>
          <Badge variant={compiledAuditPolicy.enabled ? "secondary" : "outline"}>
            {compiledAuditPolicy.enabled ? "Auditor enabled" : "No audit policy"}
          </Badge>
        </div>
        {compiledAuditPolicy.enabled ? (
          <div className="mt-4 space-y-3">
            {compiledAuditPolicy.minExtractionConfidence != null && (
              <p className="text-xs text-muted-foreground">
                Confidence threshold:{" "}
                <span className="font-medium text-foreground">
                  {Math.round(compiledAuditPolicy.minExtractionConfidence * 100)}%
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {compiledAuditPolicy.ruleSet.map((rule) => (
                <Badge
                  key={rule.id}
                  variant={rule.enabled ? "secondary" : "outline"}
                  className={cn("whitespace-normal py-1 text-left", !rule.enabled && "opacity-60")}
                >
                  {rule.label}
                </Badge>
              ))}
            </div>
            {compiledAuditPolicy.summary.length > 0 && (
              <p className="text-caption text-muted-foreground">
                Active: {compiledAuditPolicy.summary.join(", ")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-caption text-muted-foreground">
            Add a short plain-English policy to turn this agent into an invoice auditor with explicit escalation rules.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Allowed payout rails</h3>
        <p className="text-caption text-muted-foreground mt-1 mb-3">
          Select every rail this agent may request. Same list is used for payment-method enforcement.
        </p>
        <Controller
          control={control}
          name="allowedRails"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {AGENT_PAYOUT_RAILS.map((r) => {
                const on = field.value.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => field.onChange(toggleInList(field.value, r.value))}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/10 ring-1 ring-primary/25"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <span className="font-medium text-foreground">{r.label}</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{r.value}</p>
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Allowed categories</h3>
        <p className="text-caption text-muted-foreground mt-1 mb-3">
          Toggle common categories; add custom codes below. Merged with wallet — intersection when both define lists.
        </p>
        <Controller
          control={control}
          name="allowedCategories"
          render={({ field }) => (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {AGENT_SPEND_CATEGORY_PRESETS.map((c) => {
                  const on = field.value.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => field.onChange(toggleInList(field.value, c.value))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <TagListField
                value={field.value}
                onChange={field.onChange}
                label="Custom categories"
                description="Extra category strings (e.g. internal GL codes). Same list as toggles above."
                placeholder="Type and press Enter"
              />
            </div>
          )}
        />
      </div>

      <Controller
        control={control}
        name="vendorAllowlist"
        render={({ field }) => (
          <TagListField
            value={field.value}
            onChange={field.onChange}
            label="Vendor allowlist"
            description="If any entries exist, vendor string must match at least one (substring)."
            placeholder="e.g. Acme Corp"
          />
        )}
      />
      <Controller
        control={control}
        name="vendorDenylist"
        render={({ field }) => (
          <TagListField
            value={field.value}
            onChange={field.onChange}
            label="Vendor denylist"
            description="Blocks if vendor string contains any entry."
            placeholder="Blocked substring"
          />
        )}
      />
      <Controller
        control={control}
        name="restrictedVendors"
        render={({ field }) => (
          <TagListField
            value={field.value}
            onChange={field.onChange}
            label="Restricted vendors"
            description="Merged with wallet restricted list."
            placeholder="Restricted substring"
          />
        )}
      />
    </div>
  );
}
