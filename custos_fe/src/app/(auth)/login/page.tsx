"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

const oauthErrorHints: Record<string, string> = {
  OAuthSignin:
    "Google rejected the sign-in request. Usually: wrong Client ID/Secret, missing NEXTAUTH_SECRET, or redirect URI mismatch in Google Cloud Console.",
  OAuthCallback:
    "OAuth callback failed — check redirect URI matches exactly: http://localhost:3000/api/auth/callback/google",
  AccessDenied: "You cancelled sign-in or your email is not allowed (add yourself as a Test user if the app is in Testing).",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setOauthError(err);
      setIsLoadingGoogle(false);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-gradient text-heading-1 text-foreground">Custos</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Spend governance for AI agents. Connect agents, set policies, and control every payment.
          </p>
        </div>
        <Card className="border-border shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Continue with Google or enter your email. Email sign-in is in development.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <p className="font-medium">Sign-in error: {oauthError}</p>
                <p className="mt-1 text-muted-foreground">
                  {oauthErrorHints[oauthError] ??
                    "See terminal (NextAuth debug) and verify .env.local: NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL."}
                </p>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              disabled={isLoadingGoogle}
              onClick={() => {
                if (!authEnabled) {
                  // Backend auth not wired yet: allow entering the product directly.
                  router.push("/overview");
                  return;
                }
                setIsLoadingGoogle(true);
                void signIn("google", { callbackUrl: "/overview" });
              }}
            >
              {isLoadingGoogle ? "Redirecting…" : "Continue with Google"}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoadingEmail || !email}
                onClick={() => {
                  setIsLoadingEmail(true);
                  // TODO: Wire to credentials provider / magic link when backend is ready
                  setIsLoadingEmail(false);
                }}
              >
                Continue with Email (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-caption text-muted-foreground">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
