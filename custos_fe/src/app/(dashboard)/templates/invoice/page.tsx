"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadInvoice, extractInvoice } from "@/lib/api/invoice";
import { requestTransaction } from "@/lib/api/transactions";
import type { InvoiceExtractionResult } from "@/lib/types";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "@/lib/api/wallets";
import { getAgents } from "@/lib/api/agents";

export default function InvoiceAgentPage() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<InvoiceExtractionResult | null>(null);
  const [txResult, setTxResult] = useState<Awaited<ReturnType<typeof requestTransaction>> | null>(null);
  const [walletId, setWalletId] = useState("");
  const [agentId, setAgentId] = useState("");

  const { data: walletsData } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 100 }],
    queryFn: () => getWallets({ page: 1, pageSize: 100 }),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents", { page: 1, pageSize: 100 }],
    queryFn: () => getAgents({ page: 1, pageSize: 100 }),
  });
  const wallets = walletsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  useEffect(() => {
    const fromUrl = searchParams.get("agentId");
    if (!fromUrl || agents.length === 0) return;
    const agent = agents.find((a) => a.id === fromUrl);
    if (agent) {
      setAgentId(fromUrl);
      setWalletId(agent.assignedWalletId);
    }
  }, [searchParams, agents]);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadInvoice(f),
    onSuccess: (res) => {
      setFileId(res.fileId);
    },
  });

  const extractMutation = useMutation({
    mutationFn: (id: string) => extractInvoice(id),
    onSuccess: setExtraction,
  });

  const requestMutation = useMutation({
    mutationFn: (body: Parameters<typeof requestTransaction>[0]) =>
      requestTransaction(body),
    onSuccess: setTxResult,
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileId(null);
      setExtraction(null);
      setTxResult(null);
    }
  }

  function handleUpload() {
    if (!file) return;
    uploadMutation.mutate(file);
  }

  function handleExtract() {
    if (fileId) extractMutation.mutate(fileId);
  }

  function handleSubmitRequest() {
    if (!extraction?.amount || !walletId || !agentId) return;
    const wallet = wallets.find((w) => w.id === walletId);
    requestMutation.mutate({
      agentId,
      walletId,
      amount: extraction.amount,
      currency: wallet?.currency ?? "USD",
      vendor: extraction.vendor,
      memo: extraction.memo,
      evidence: fileId
        ? [{ type: "invoice", fileId, ...extraction }]
        : undefined,
    });
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Invoice Agent</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Upload an invoice, extract fields, and submit a payment request for policy evaluation.
        </p>
        {searchParams.get("agentId") && (
          <p className="mt-2 text-caption text-muted-foreground">
            Agent and wallet pre-filled from your link. Requires a Custos session (same as the dashboard).
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload invoice
            </CardTitle>
            <CardDescription>
              Image or PDF. Extraction is performed via API (OCR).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="max-w-xs"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {file && (
              <p className="text-body-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
            {fileId && (
              <Button
                variant="outline"
                onClick={handleExtract}
                disabled={extractMutation.isPending}
              >
                {extractMutation.isPending ? "Extracting…" : "Extract fields"}
              </Button>
            )}
          </CardContent>
        </Card>

        {extraction && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Extracted fields
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-body-sm">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p>{extraction.vendor ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice #</Label>
                  <p>{extraction.invoiceNumber ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p>
                    {extraction.amount != null
                      ? formatCurrency(extraction.amount)
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due date</Label>
                  <p>{extraction.dueDate ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Memo</Label>
                  <p>{extraction.memo ?? "—"}</p>
                </div>
                {extraction.confidence != null && (
                  <div>
                    <Label className="text-muted-foreground">Confidence</Label>
                    <p>{Math.round(extraction.confidence * 100)}%</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Label className="w-full text-muted-foreground">Submit payment request</Label>
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  <option value="">Select wallet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                >
                  <option value="">Select agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleSubmitRequest}
                  disabled={
                    requestMutation.isPending ||
                    !walletId ||
                    !agentId ||
                    extraction.amount == null
                  }
                >
                  {requestMutation.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {txResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Policy decision</CardTitle>
            <CardDescription>
              Transaction request evaluated. Result below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <TransactionStatusBadge status={txResult.status} />
              {txResult.policyResult && (
                <span className="text-body-sm text-muted-foreground">
                  — {txResult.policyResult.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/transactions/${txResult.id}`}>View transaction</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
