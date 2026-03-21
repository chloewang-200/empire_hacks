"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWorkspace,
  patchWorkspace,
  type WorkspaceFundingPreference,
  type WorkspaceSpendMode,
} from "@/lib/api/workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const initial = session?.user?.name?.slice(0, 1) ?? session?.user?.email?.slice(0, 1) ?? "?";

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
  });

  const patch = useMutation({
    mutationFn: patchWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Settings</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Account and platform configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="text-lg">{initial.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{session?.user?.name ?? "User"}</p>
            <p className="text-body-sm text-muted-foreground">{session?.user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funding preference</CardTitle>
          <CardDescription>
            Your <strong>default</strong> for how you like to cover spend. This does not lock the wallet to one
            method — you can still top up with card, treasury credit, or any enabled rail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <Skeleton className="h-10 w-full max-w-sm" />}
          {!isLoading && workspace && (
            <>
              <div className="space-y-2">
                <Label htmlFor="funding-preference">Preference</Label>
                <Select
                  value={workspace.fundingPreference ?? "BOTH"}
                  onValueChange={(v) =>
                    patch.mutate({ fundingPreference: v as WorkspaceFundingPreference })
                  }
                  disabled={patch.isPending}
                >
                  <SelectTrigger id="funding-preference" className="max-w-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">No default — pick what fits each time</SelectItem>
                    <SelectItem value="BALANCE_FIRST">
                      Prefer pre-funded balance — top up, then spend from the wallet
                    </SelectItem>
                    <SelectItem value="CARD_AT_SPEND">
                      Prefer card-at-spend — charge a card when a payment runs (when supported)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-caption text-muted-foreground max-w-lg">
                Wallets are not limited to a single payment type. This setting nudges copy and defaults;{" "}
                <strong>Add funds</strong> always lists every rail your workspace can use.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound spend policy</CardTitle>
          <CardDescription>
            How agent and card <strong>spend</strong> is governed. Add funds always supports every enabled rail
            (card, Carlos treasury code, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <Skeleton className="h-10 w-full max-w-sm" />}
          {!isLoading && workspace && (
            <>
              <div className="space-y-2">
                <Label htmlFor="spend-mode">Policy</Label>
                <Select
                  value={workspace.spendMode}
                  onValueChange={(v) =>
                    patch.mutate({ spendMode: v as WorkspaceSpendMode })
                  }
                  disabled={patch.isPending}
                >
                  <SelectTrigger id="spend-mode" className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRIPE_TEST">
                      Standard — spend follows each wallet’s approval rules
                    </SelectItem>
                    <SelectItem value="MANUAL_REAL">
                      Carlos / manual ops — outbound spend often needs human review
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-caption text-muted-foreground max-w-lg">
                This does <strong>not</strong> turn off card top-ups or Carlos treasury credits (secret code) —
                those are payment
                methods in <strong>Add funds</strong>. It only affects how transactions are approved when money
                leaves the wallet.
              </p>
              {patch.isError && (
                <p className="text-sm text-destructive">{(patch.error as Error).message}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication</CardTitle>
          <CardDescription>Sign-in provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm">
            Signed in with <Badge variant="secondary">Google</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
          <CardDescription>Developer-facing.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm">
            <span className="text-muted-foreground">Stripe:</span>{" "}
            <Badge variant="secondary">Test keys in .env</Badge>
          </p>
        </CardContent>
      </Card>

      <Separator />

      <p className="text-caption text-muted-foreground">
        Custos — Spend governance for AI agents. Control layer and decisioning layer for agent payments.
      </p>
    </div>
  );
}
