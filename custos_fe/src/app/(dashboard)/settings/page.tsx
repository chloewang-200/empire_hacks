"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { data: session } = useSession();
  const initial = session?.user?.name?.slice(0, 1) ?? session?.user?.email?.slice(0, 1) ?? "?";

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
          <CardTitle className="text-base">Authentication</CardTitle>
          <CardDescription>Sign-in provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm">
            Signed in with{" "}
            <Badge variant="secondary">Google</Badge>
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            Email sign-in is available as a template and can be wired when the backend is ready.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
          <CardDescription>Platform and API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-body-sm">
            <span className="text-muted-foreground">Mode:</span>{" "}
            <Badge variant="secondary">Testing</Badge>
          </p>
          <p className="text-caption text-muted-foreground">
            API and developer docs link can be added here.
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
