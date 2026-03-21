import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { provisionCustosUser } from "@/lib/custosProvision";

const googleId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim() ?? "";

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  debug: process.env.NODE_ENV === "development",
  providers: [
    GoogleProvider({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  ],
  /** Run after OAuth succeeds — keeps OAuth callback path simple (avoids signIn-callback edge cases). */
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user?.email) {
        try {
          await provisionCustosUser({
            email: user.email,
            name: user.name,
            image: user.image,
          });
        } catch (e) {
          console.error("[custos] provisionCustosUser error:", e);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
