"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { Agent } from "@/lib/types";
import { AgentFormDialog } from "@/components/agents/AgentFormDialog";
import { useState } from "react";

interface AgentsOverviewSectionProps {
  agents: Agent[];
  isLoading: boolean;
}

export function AgentsOverviewSection({ agents, isLoading }: AgentsOverviewSectionProps) {
  const router = useRouter();
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const hasAgents = agents.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Agents</h2>
          {hasAgents && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agents">View all</Link>
            </Button>
          )}
        </div>
        <div className="p-4">
          {!hasAgents ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-neutral-950 shadow-sm ring-1 ring-black/5 dark:bg-neutral-800 dark:text-neutral-50 dark:ring-white/10">
                <Bot className="h-7 w-7" strokeWidth={2} />
              </div>
              <h3 className="mt-4 text-sm font-medium text-foreground">
                No agents yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Connect your first AI agent to start governing spend. Assign it to a wallet and set policies.
              </p>
              <Button
                className="mt-6"
                size="lg"
                onClick={() => setAddAgentOpen(true)}
              >
                <Plus className="mr-2 h-5 w-5" />
                Add your first agent
              </Button>
            </div>
          ) : (
            <ul className="space-y-0">
              {agents.slice(0, 6).map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/agents/${agent.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-950 shadow-sm ring-1 ring-black/5 dark:bg-neutral-800 dark:text-neutral-50 dark:ring-white/10">
                      <Bot className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {agent.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.templateType}
                        {agent.assignedWalletName && ` · ${agent.assignedWalletName}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {agent.transactionVolume != null && (
                        <span className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(agent.transactionVolume)}
                        </span>
                      )}
                      <AgentStatusBadge status={agent.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasAgents && agents.length > 6 && (
            <div className="mt-2 border-t border-border pt-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/agents">View all {agents.length} agents</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <AgentFormDialog open={addAgentOpen} onOpenChange={setAddAgentOpen} />
    </>
  );
}
