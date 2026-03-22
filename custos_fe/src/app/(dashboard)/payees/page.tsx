"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Building2, Pencil } from "lucide-react";
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
import { getPayees, createPayee, deletePayee, updatePayee } from "@/lib/api/payees";
import type { ApprovedPayee } from "@/lib/types";
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

  const [editingPayee, setEditingPayee] = useState<ApprovedPayee | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editLegalName, setEditLegalName] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [editDefaultRail, setEditDefaultRail] = useState("merchant_card");
  const [editPaymentInstructions, setEditPaymentInstructions] = useState("");
  const [editStripeConnectAccountId, setEditStripeConnectAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!editingPayee) return;
    setEditDisplayName(editingPayee.displayName);
    setEditLegalName(editingPayee.legalName ?? "");
    setEditAliases(editingPayee.aliases.join(", "));
    setEditDefaultRail(editingPayee.defaultRail);
    setEditPaymentInstructions(editingPayee.paymentInstructions ?? "");
    setEditStripeConnectAccountId(editingPayee.stripeConnectAccountId ?? "");
    setEditNotes(editingPayee.notes ?? "");
  }, [editingPayee]);

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

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editingPayee) throw new Error("No payee");
      const aliasList = editAliases
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return updatePayee(editingPayee.id, {
        displayName: editDisplayName.trim(),
        legalName: editLegalName.trim() || null,
        aliases: aliasList,
        defaultRail: editDefaultRail,
        paymentInstructions: editPaymentInstructions.trim() || null,
        stripeConnectAccountId: editStripeConnectAccountId.trim() || null,
        notes: editNotes.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payees"] });
      setEditingPayee(null);
    },
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
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${p.displayName}`}
                    onClick={() => setEditingPayee(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${p.displayName}`}
                    onClick={() => {
                      if (confirm(`Remove payee “${p.displayName}”?`)) deleteMut.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
                Required for auto payout: a real <code className="text-xs">acct_</code> from your Stripe Connect
                accounts (test mode works). Fake IDs are rejected by Stripe when Custos creates a transfer. You can add
                or change this later with Edit on the payee card.
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

      <Dialog open={!!editingPayee} onOpenChange={(o) => !o && setEditingPayee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit approved payee</DialogTitle>
          </DialogHeader>
          {editingPayee && (
            <>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="edn">Display name *</Label>
                  <Input
                    id="edn"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="e.g. Acme Cloud Services"
                  />
                </div>
                <div>
                  <Label htmlFor="eln">Legal name</Label>
                  <Input
                    id="eln"
                    value={editLegalName}
                    onChange={(e) => setEditLegalName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="eal">Alternate names (comma or newline)</Label>
                  <Textarea
                    id="eal"
                    value={editAliases}
                    onChange={(e) => setEditAliases(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label>Default payout rail</Label>
                  <Select value={editDefaultRail} onValueChange={setEditDefaultRail}>
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
                  <Label htmlFor="epi">How to pay (masked is fine)</Label>
                  <Textarea
                    id="epi"
                    value={editPaymentInstructions}
                    onChange={(e) => setEditPaymentInstructions(e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="estripe">Stripe Connect account</Label>
                  <Input
                    id="estripe"
                    value={editStripeConnectAccountId}
                    onChange={(e) => setEditStripeConnectAccountId(e.target.value)}
                    placeholder="acct_… from Stripe Dashboard (Connect → Accounts)"
                    className="font-mono text-sm"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">
                    Use a real <code className="text-xs">acct_</code> from your Stripe account (test mode is fine).
                    Random or made-up IDs will not work — Stripe validates them when Custos runs a transfer.
                  </p>
                </div>
                <div>
                  <Label htmlFor="eno">Internal notes</Label>
                  <Input id="eno" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
              </div>
              {updateMut.isError && (
                <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPayee(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => updateMut.mutate()}
                  disabled={updateMut.isPending || !editDisplayName.trim()}
                >
                  {updateMut.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
