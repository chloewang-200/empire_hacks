import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { isAgentSpendAllowedStatus } from "./agentGovernance.js";
import { prisma } from "./prisma.js";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 26);

export function generateApiKey(): { fullKey: string; keyPrefix: string; keyPrefixStored: string } {
  const fullKey = `custos_${nanoid()}`;
  const keyPrefixStored = fullKey.slice(0, 12);
  const keyPrefix = `${fullKey.slice(0, 8)}…`;
  return { fullKey, keyPrefix, keyPrefixStored };
}

export async function hashApiKey(fullKey: string): Promise<string> {
  return bcrypt.hash(fullKey, 12);
}

export async function verifyApiKey(fullKey: string) {
  if (!fullKey.startsWith("custos_")) return null;
  const keyPrefixStored = fullKey.slice(0, 12);
  const row = await prisma.agentApiKey.findFirst({
    where: { revokedAt: null, keyPrefix: keyPrefixStored },
    include: { agent: { include: { wallet: true, workspace: true } } },
  });
  if (!row) return null;
  const ok = await bcrypt.compare(fullKey, row.keyHash);
  if (!ok) return null;
  if (!isAgentSpendAllowedStatus(row.agent.status)) return null;
  return row.agent;
}
