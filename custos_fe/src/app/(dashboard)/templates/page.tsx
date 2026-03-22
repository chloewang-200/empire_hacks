"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getTemplates } from "@/lib/api/templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesPage() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Agent Templates</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Reusable agent integrations. Configure and deploy agents from templates.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates?.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {t.description}
                  </CardDescription>
                </div>
                <Badge
                  variant={t.status === "available" ? "default" : "secondary"}
                >
                  {t.status === "coming_soon" ? "Coming soon" : "Available"}
                </Badge>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                {t.status === "available" && t.id === "event_production" ? (
                  <Button asChild>
                    <Link href="/templates/event-production">Open</Link>
                  </Button>
                ) : t.status === "available" && t.id === "invoice" ? (
                  <Button asChild>
                    <Link href="/templates/invoice">Configure</Link>
                  </Button>
                ) : (
                  <Button disabled variant="outline">
                    Configure
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
