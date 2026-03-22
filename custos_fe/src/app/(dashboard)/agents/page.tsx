"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAgents } from "@/lib/api/agents";
import { AgentStatusBadge } from "@/components/status/StatusBadge";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentFormDialog } from "@/components/agents/AgentFormDialog";

export default function AgentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["agents", { page: 1, pageSize: 50 }],
    queryFn: () => getAgents({ page: 1, pageSize: 50 }),
  });

  const agents = data?.data ?? [];
  const filtered = search
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.templateType.toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Agents</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            AI agents connected to the platform. Assign wallets and manage capabilities.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add agent
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No agents match your search" : "No agents yet"}
            description={search ? "Try a different search." : "Add an agent to get started."}
            action={!search && <Button onClick={() => setFormOpen(true)}>Add agent</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((agent) => (
                <TableRow
                  key={agent.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/agents/${agent.id}`)}
                >
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="capitalize">{agent.templateType}</TableCell>
                    <TableCell>{agent.assignedWalletName ?? agent.assignedWalletId}</TableCell>
                    <TableCell className="capitalize">{agent.role}</TableCell>
                    <TableCell>
                      <AgentStatusBadge status={agent.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.transactionVolume != null
                        ? formatCurrency(agent.transactionVolume)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {agent.lastActiveAt ? formatDate(agent.lastActiveAt) : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/agents/${agent.id}`)}>View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/agents/${agent.id}/edit`)}>Edit</DropdownMenuItem>
                          {agent.templateType === "invoice" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/templates/invoice?agentId=${encodeURIComponent(agent.id)}`}>
                                Invoice upload (this agent)
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/transactions?agentId=${agent.id}`}>View transactions</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AgentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
