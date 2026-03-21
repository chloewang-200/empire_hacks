"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TotalAgentsCardProps {
  total: number;
  activeCount: number;
}

export function TotalAgentsCard({ total, activeCount }: TotalAgentsCardProps) {
  return (
    <Link href="/agents" className="block transition-opacity hover:opacity-95">
      <Card className="overflow-hidden rounded-2xl border-0 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Bot className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium opacity-90">Total Agents</p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {total}
                </p>
                <p className="mt-0.5 text-xs opacity-80">
                  {activeCount} active · connected to wallets
                </p>
              </div>
            </div>
            <span className="text-xs font-medium opacity-80">View all</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
