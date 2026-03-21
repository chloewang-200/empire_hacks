"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Key, Copy, RefreshCw, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotateAgentApiKey } from "@/lib/api/agents";

interface ApiKeyRevealCardProps {
  agentId: string;
}

export function ApiKeyRevealCard({ agentId }: ApiKeyRevealCardProps) {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rotateMutation = useMutation({
    mutationFn: () => rotateAgentApiKey(agentId),
    onSuccess: (data) => {
      if (data.fullKey) setRevealedKey(data.fullKey);
    },
  });

  function handleCopy() {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          API credentials
        </CardTitle>
        <p className="text-caption text-muted-foreground">
          Keys are generated on custos_be and shown only once. You must be signed in to the app (Custos JWT in
          session) so the request can be authorized.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => rotateMutation.mutate()}
            disabled={rotateMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rotateMutation.isPending ? "animate-spin" : ""}`} />
            {revealedKey ? "Rotate key" : "Generate key"}
          </Button>
          {rotateMutation.isError && (
            <p className="text-sm text-destructive">
              {rotateMutation.error instanceof Error
                ? rotateMutation.error.message
                : "Could not generate key"}
            </p>
          )}
        </div>
        {rotateMutation.data && (
          <div className="rounded-md border border-border bg-muted/50 p-3 font-mono text-sm">
            {revealedKey ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all">{revealedKey}</code>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRevealedKey(null)}
                      aria-label="Hide key"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCopy}
                      aria-label="Copy key"
                    >
                      <Copy className="h-4 w-4" />
                      {copied && " Copied"}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-caption text-amber-600 dark:text-amber-400">
                  Shown once. Copy and store in a secure place.
                </p>
              </>
            ) : (
              <span className="text-muted-foreground">{rotateMutation.data.keyPrefix}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
