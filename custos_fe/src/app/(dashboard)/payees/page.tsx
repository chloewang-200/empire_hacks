"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPayees, createPayee, deletePayee } from "@/lib/api/payees";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RAILS = [
  { value: "merchant_card", label: "Card" },
  { value: "stripe_connect", label: "Stripe Connect" },
  { value: "ach", label: "ACH" },
  { value: "venmo_p2p", label: "Venmo (manual / unsupported auto)" },
  { value: "wire", label: "Wire" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

export default function PayeesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [aliases, setAliases] = useState("");
  const [defaultRail, setDefaultRail] = useState("merchant_card");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: payees, isLoading } = useQuery({
    queryKey: ["payees"],
    queryFn: getPayees,
  });

  const createMut = useMutation({
    mutationFn: createPayee,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payees"] });
      setOpen(false);
      setDisplayName("");
      setLegalName("");
      setAliases("");
      setPaymentInstructions("");
      setStripeConnectAccountId("");
      setNotes("");
      setDefaultRail("merchant_card");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deletePayee,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payees"] }),
  });

  function handleCreate() {
    if (!displayName.trim()) return;
    const aliasList = aliases
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    createMut.mutate({
      displayName: displayName.trim(),
      legalName: legalName.trim() || undefined,
      aliases: aliasList.length ? aliasList : undefined,
      defaultRail,
      paymentInstructions: paymentInstructions.trim() || undefined,
      stripeConnectAccountId: stripeConnectAccountId.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Approved payees</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-muted-foreground">
            Directory of vendors you trust. Agent requests match by <strong>vendor</strong> string (or explicit{" "}
            <code className="text-xs">payeeId</code> in the API). Turn on{" "}
            <strong>Require approved payee</strong> on a wallet to send unmatched requests to review.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add payee
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && payees && payees.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-body-sm text-muted-foreground">No payees yet. Add one to enable directory matching.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Add your first payee
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {payees?.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{p.displayName}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label={`Delete ${p.displayName}`}
                  onClick={() => {
                    if (confirm(`Remove payee “${p.displayName}”?`)) deleteMut.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {p.legalName && <CardDescription>{p.legalName}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2 text-body-sm">
              <p>
                <span className="text-muted-foreground">Rail:</span> {p.defaultRail}
              </p>
              {p.aliases.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Also matches:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.aliases.map((a) => (
                      <Badge key={a} variant="secondary" className="font-normal">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {p.paymentInstructions && (
                <p className="rounded-md bg-muted/50 p-2 text-caption">{p.paymentInstructions}</p>
              )}
              {p.stripeConnectAccountId && (
                <p className="font-mono text-caption text-muted-foreground">
                  Stripe Connect: {p.stripeConnectAccountId}
                </p>
              )}
              {p.notes && <p className="text-caption text-muted-foreground">{p.notes}</p>}
              {!p.active && <Badge variant="warning">Inactive</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add approved payee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="dn">Display name *</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Acme Cloud Services"
              />
            </div>
            <div>
              <Label htmlFor="ln">Legal name</Label>
              <Input
                id="ln"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="al">Alternate names (comma or newline)</Label>
              <Textarea
                id="al"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="ACME, Acme LLC"
                rows={2}
                className="resize-none"
              />
              <p className="mt-1 text-caption text-muted-foreground">Used to match invoice / agent vendor strings.</p>
            </div>
            <div>
              <Label>Default payout rail</Label>
              <Select value={defaultRail} onValueChange={setDefaultRail}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAILS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pi">How to pay (masked is fine)</Label>
              <Textarea
                id="pi"
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="e.g. ACH to Chase ****4521 — remit ref: INV#"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="stripe">Stripe Connect account (optional)</Label>
              <Input
                id="stripe"
                value={stripeConnectAccountId}
                onChange={(e) => setStripeConnectAccountId(e.target.value)}
                placeholder="acct_… for automated transfers"
                className="font-mono text-sm"
              />
              <p className="mt-1 text-caption text-muted-foreground">
                Required on the payee (or pass <code className="text-xs">stripeConnectAccountId</code> on the payment
                API) when using auto payout to Stripe.
              </p>
            </div>
            <div>
              <Label htmlFor="no">Internal notes</Label>
              <Input id="no" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          {createMut.isError && (
            <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending || !displayName.trim()}>
              {createMut.isPending ? "Saving…" : "Save payee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
