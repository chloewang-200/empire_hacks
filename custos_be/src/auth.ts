import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

const JWT_SECRET = process.env.CUSTOS_JWT_SECRET ?? "dev-insecure-change-me";
const INTERNAL_SECRET = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";

export function signUserToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "14d" });
}

export function verifyUserToken(token: string): { userId: string; email: string } | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    return { userId: p.sub, email: p.email };
  } catch {
    return null;
  }
}

export function assertInternalSecret(header: string | undefined) {
  if (header !== INTERNAL_SECRET) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }
}

export function getInternalSecret(): string {
  return INTERNAL_SECRET;
}

export async function getUserFromBearer(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const v = verifyUserToken(token);
  if (!v) return null;
  const user = await prisma.user.findUnique({ where: { id: v.userId } });
  return user;
}

export async function getDefaultDemoUser() {
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}
