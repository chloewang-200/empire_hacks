import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { provisionCustosUser } from "@/lib/custosProvision";

const googleId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim() ?? "";

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  debug: process.env.NODE_ENV === "development",
  providers: [
    CredentialsProvider({
      name: "Admin Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (credentials?.email) {
          const normalizedEmail = credentials.email.trim().toLowerCase();
          const isAdmin = normalizedEmail === "admin@custos.ai";

          return {
            id: isAdmin ? "admin-email-user" : `customer-${normalizedEmail}`,
            name: isAdmin ? "Admin" : normalizedEmail.split("@")[0],
            email: normalizedEmail,
            role: isAdmin ? "admin" : "customer",
          };
        }

        if (
          credentials?.username === "admin" &&
          credentials?.password === "password"
        ) {
          return {
            id: "admin-user",
            name: "Admin",
            email: "admin@custos.ai",
            role: "admin",
          };
        }

        return null;
      },
    }),
    GoogleProvider({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
    // TODO: Add credentials provider for email sign-in when backend is ready
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? "customer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role ?? "customer") as
          | "admin"
          | "customer";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
