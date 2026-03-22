"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, LayoutTemplate, ArrowLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAgent, updateAgent } from "@/lib/api/agents";
import { agentFormSchema, type AgentFormValues } from "@/lib/validators/agent";
import { AGENT_ROLES, AGENT_STARTER_TEMPLATES } from "@/lib/constants";
import { applyStarterTemplateFields } from "@/lib/agentTemplatePresets";
import { AgentGovernanceStep } from "@/components/agents/AgentGovernanceStep";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "@/lib/api/wallets";
import { cn } from "@/lib/utils";

type FlowStep = "choose" | "form";
type CreationPath = "custom" | "template" | null;
type AgentPanel = "basics" | "governance";

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<AgentFormValues>;
  agentId?: string;
}

export function AgentFormDialog({
  open,
  onOpenChange,
  defaultValues,
  agentId,
}: AgentFormDialogProps) {
  const isEdit = Boolean(agentId);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<FlowStep>(isEdit ? "form" : "choose");
  const [creationPath, setCreationPath] = useState<CreationPath>(null);
  const [agentPanel, setAgentPanel] = useState<AgentPanel>("basics");

  const { data: walletsData } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 100 }],
    queryFn: () => getWallets({ page: 1, pageSize: 100 }),
  });
  const wallets = walletsData?.data ?? [];

  const form = useForm<AgentFormValues, unknown, AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      templateType: undefined,
      assignedWalletId: "",
      role: "requester",
      capabilities: defaultValues?.capabilities ?? [],
      status: "active",
      monthlyAllowance: undefined,
      dailySpendLimit: undefined,
      approvalThreshold: undefined,
      maxTransactionAmount: undefined,
      requireApprovedPayee: false,
      auditPolicyText: "",
      vendorAllowlist: [],
      vendorDenylist: [],
      restrictedVendors: [],
      allowedCategories: [],
      allowedRails: [],
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setStep("form");
      setCreationPath(null);
      setAgentPanel("basics");
    } else {
      setStep("choose");
      setCreationPath(null);
      setAgentPanel("basics");
      form.reset({
        name: "",
        description: "",
        templateType: undefined,
        assignedWalletId: "",
        role: "requester",
        capabilities: defaultValues?.capabilities ?? [],
        status: "active",
        monthlyAllowance: undefined,
        dailySpendLimit: undefined,
        approvalThreshold: undefined,
        maxTransactionAmount: undefined,
        requireApprovedPayee: false,
        auditPolicyText: "",
        vendorAllowlist: [],
        vendorDenylist: [],
        restrictedVendors: [],
        allowedCategories: [],
        allowedRails: [],
        ...defaultValues,
      });
    }
  }, [open, isEdit, defaultValues, form]);

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof createAgent>[0]) =>
      agentId ? updateAgent(agentId, body) : createAgent(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (agentId) queryClient.invalidateQueries({ queryKey: ["agents", agentId] });
      onOpenChange(false);
      form.reset();
      setStep(isEdit ? "form" : "choose");
      setCreationPath(null);
      setAgentPanel("basics");
    },
  });

  function handleChooseCustom() {
    setCreationPath("custom");
    form.setValue("templateType", "custom");
    setStep("form");
  }

  function handleChooseTemplate() {
    setCreationPath("template");
    form.setValue("templateType", undefined);
    setStep("form");
  }

  function handleBackToChoice() {
    setStep("choose");
    setCreationPath(null);
    form.setValue("templateType", undefined);
  }

  function onSubmit(values: AgentFormValues) {
    if (!isEdit && creationPath === "template") {
      const t = values.templateType?.trim();
      if (!t) {
        form.setError("templateType", {
          type: "manual",
          message: "Choose a template to continue",
        });
        setAgentPanel("basics");
        return;
      }
    }

    const resolvedTemplate =
      isEdit
        ? values.templateType?.trim() || undefined
        : !isEdit && creationPath === "custom"
          ? "custom"
          : values.templateType?.trim() || "custom";

    const rails = values.allowedRails ?? [];

    const body: Parameters<typeof createAgent>[0] = {
      name: values.name,
      description: values.description,
      agentType: resolvedTemplate === "event_production" ? "event_production" : undefined,
      templateType: resolvedTemplate ?? "custom",
      assignedWalletId: values.assignedWalletId,
      role: values.role,
      capabilities: values.capabilities,
      status: values.status,
      monthlyAllowance: values.monthlyAllowance,
      dailySpendLimit: values.dailySpendLimit,
      approvalThreshold: values.approvalThreshold,
      maxTransactionAmount: values.maxTransactionAmount,
      requireApprovedPayee: values.requireApprovedPayee === true,
      vendorAllowlist: values.vendorAllowlist ?? [],
      vendorDenylist: values.vendorDenylist ?? [],
      restrictedVendors: values.restrictedVendors ?? [],
      allowedCategories: values.allowedCategories ?? [],
      allowedPayoutRails: rails,
      allowedPaymentMethods: rails,
      settings: {
        auditPolicyText: values.auditPolicyText?.trim() || "",
      },
    };
    createMutation.mutate(body);
  }

  async function goToGovernance() {
    const fields: ("name" | "assignedWalletId" | "templateType")[] = ["name", "assignedWalletId"];
    if (!isEdit && creationPath === "template") fields.push("templateType");
    const ok = await form.trigger(fields);
    if (ok) setAgentPanel("governance");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          step === "choose" && !isEdit ? "max-w-3xl" : "sm:max-w-2xl",
          "max-h-[90vh] overflow-y-auto"
        )}
      >
        {step === "choose" && !isEdit ? (
          <>
            <DialogHeader>
              <DialogTitle>Add an agent</DialogTitle>
              <DialogDescription>
                Choose how you want to connect this agent to Custos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleChooseCustom}
                className={cn(
                  "group flex flex-col rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-all",
                  "hover:border-primary/50 hover:bg-muted/40 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-950 transition-colors group-hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:group-hover:bg-neutral-700">
                  <Plug className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-950 dark:text-neutral-50">
                  Connect your agent
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  You already have an agent or integration. Register it here, assign a wallet, and use API keys to send transaction requests.
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-neutral-950 underline decoration-2 underline-offset-4 decoration-yellow-400 dark:text-neutral-50 dark:decoration-yellow-500">
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={handleChooseTemplate}
                className={cn(
                  "group flex flex-col rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-all",
                  "hover:border-primary/50 hover:bg-muted/40 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-950 transition-colors group-hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:group-hover:bg-neutral-700">
                  <LayoutTemplate className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-950 dark:text-neutral-50">
                  Start from a template
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Use a pre-built agent type (e.g. Invoice, Travel). We’ll preconfigure roles and flows you can extend later.
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-neutral-950 underline decoration-2 underline-offset-4 decoration-yellow-400 dark:text-neutral-50 dark:decoration-yellow-500">
                  Choose template
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              {!isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-1 w-fit gap-1 px-2 text-muted-foreground"
                  onClick={handleBackToChoice}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <DialogTitle>{isEdit ? "Edit agent" : "Agent details"}</DialogTitle>
              <DialogDescription>
                {agentPanel === "basics"
                  ? isEdit
                    ? "Identity, wallet, and role. Use Spend & routing for limits and rails."
                    : creationPath === "custom"
                      ? "Name your agent and assign a wallet. Spend rules are optional — add them on the next step or skip."
                      : "Pick a template, then name your agent and assign a wallet."
                  : "Optional spend caps, payee rules, rails, and categories for this agent (Ramp-style controls)."}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 flex rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setAgentPanel("basics")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  agentPanel === "basics"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Basics
              </button>
              <button
                type="button"
                onClick={() => setAgentPanel("governance")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  agentPanel === "governance"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Spend &amp; routing
              </button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {agentPanel === "basics" && (
                  <>
                    {!isEdit && creationPath === "custom" && (
                      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Custom integration</span>
                        — no template preset. You’ll configure behavior via API and policies.
                      </div>
                    )}

                    {!isEdit && creationPath === "template" && (
                      <FormField
                        control={form.control}
                        name="templateType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template</FormLabel>
                            <FormControl>
                              <div className="grid gap-2 sm:grid-cols-1">
                                {AGENT_STARTER_TEMPLATES.map((t) => (
                                  <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(t.value);
                                      form.clearErrors("templateType");
                                      applyStarterTemplateFields(t.value, form.setValue);
                                    }}
                                    className={cn(
                                      "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                                      field.value === t.value
                                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                        : "border-border bg-card hover:bg-muted/50"
                                    )}
                                  >
                                    <span className="font-medium text-foreground">{t.label}</span>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                                  </button>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. AP Invoice Bot" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What this agent does" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isEdit && (
                      <FormField
                        control={form.control}
                        name="templateType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template type (optional)</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                              value={field.value ?? "__none__"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Not set" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="__none__">Not specified</SelectItem>
                                <SelectItem value="custom">Custom integration</SelectItem>
                                {AGENT_STARTER_TEMPLATES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="assignedWalletId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned wallet</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select wallet" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {wallets.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  {w.name}
                                </SelectItem>
                              ))}
                              {wallets.length === 0 && (
                                <SelectItem value="_none" disabled>
                                  No wallets — create one first
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {AGENT_ROLES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {agentPanel === "governance" && <AgentGovernanceStep control={form.control} />}

                {isEdit && (
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </DialogFooter>
                )}

                {!isEdit && agentPanel === "basics" && (
                  <DialogFooter className="flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={createMutation.isPending}
                        onClick={() => void form.handleSubmit(onSubmit)()}
                      >
                        Create without spend rules
                      </Button>
                      <Button type="button" onClick={() => void goToGovernance()}>
                        Next: Spend &amp; routing
                      </Button>
                    </div>
                  </DialogFooter>
                )}

                {!isEdit && agentPanel === "governance" && (
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAgentPanel("basics")}>
                      Back
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating…" : "Create agent"}
                    </Button>
                  </DialogFooter>
                )}
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
