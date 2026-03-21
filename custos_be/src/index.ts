import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { prisma } from "./prisma.js";
import { generateApiKey, hashApiKey, verifyApiKey } from "./apiKey.js";
import {
  assertInternalSecret,
  getDefaultDemoUser,
  getUserFromBearer,
  signUserToken,
} from "./auth.js";
import { agentToJson, transactionToJson, walletToJson } from "./mappers.js";
import { submitAgentTransactionRequest } from "./transactionFlow.js";
import { stripe, stripeEnabled } from "./stripe.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = join(__dirname, "..", "uploads");

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

async function resolveUser(authHeader: string | undefined) {
  const u = await getUserFromBearer(authHeader);
  if (u) return u;
  if (process.env.CUSTOS_ALLOW_UNAUTHENTICATED_DEMO === "true") {
    return getDefaultDemoUser();
  }
  return null;
}

async function requireUser(authHeader: string | undefined) {
  const u = await resolveUser(authHeader);
  if (!u) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }
  return u;
}

async function getWorkspaceForUser(userId: string) {
  const ws = await prisma.workspace.findFirst({ where: { userId } });
  return ws;
}

app.get("/health", async () => ({ ok: true }));

app.get("/api/workspace", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  return {
    id: ws.id,
    name: ws.name,
    spendMode: ws.spendMode,
    fundingPreference: ws.fundingPreference,
  };
});

app.patch("/api/workspace", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = z
    .object({
      spendMode: z.enum(["STRIPE_TEST", "MANUAL_REAL"]).optional(),
      fundingPreference: z.enum(["BALANCE_FIRST", "CARD_AT_SPEND", "BOTH"]).optional(),
    })
    .parse(req.body);
  if (body.spendMode === undefined && body.fundingPreference === undefined) {
    return reply.status(400).send({ message: "No fields to update" });
  }
  const updated = await prisma.workspace.update({
    where: { id: ws.id },
    data: {
      ...(body.spendMode !== undefined ? { spendMode: body.spendMode } : {}),
      ...(body.fundingPreference !== undefined ? { fundingPreference: body.fundingPreference } : {}),
    },
  });
  return {
    id: updated.id,
    name: updated.name,
    spendMode: updated.spendMode,
    fundingPreference: updated.fundingPreference,
  };
});

/** Called from Next.js Stripe webhook after signature verification. */
app.post("/api/internal/stripe-credit", async (req, reply) => {
  const secret = req.headers["x-internal-secret"] as string | undefined;
  try {
    assertInternalSecret(secret);
  } catch {
    return reply.status(401).send({ message: "Unauthorized" });
  }
  const body = z
    .object({
      paymentIntentId: z.string(),
      walletId: z.string(),
      workspaceId: z.string(),
      amountCents: z.number().int().positive(),
      currency: z.string().optional(),
    })
    .parse(req.body);
  const existing = await prisma.stripePaymentLedger.findUnique({
    where: { paymentIntentId: body.paymentIntentId },
  });
  if (existing) {
    return { ok: true, duplicate: true };
  }
  const wallet = await prisma.wallet.findFirst({
    where: { id: body.walletId, workspaceId: body.workspaceId },
  });
  if (!wallet) {
    return reply.status(404).send({ message: "Wallet not found" });
  }
  await prisma.$transaction([
    prisma.stripePaymentLedger.create({
      data: {
        paymentIntentId: body.paymentIntentId,
        walletId: wallet.id,
        workspaceId: body.workspaceId,
        amountCents: body.amountCents,
        currency: (body.currency ?? "usd").toLowerCase(),
      },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: { increment: body.amountCents } },
    }),
  ]);
  return { ok: true };
});

/** Next.js server-to-server: upsert user + issue Custos JWT */
app.post("/api/internal/bootstrap", async (req, reply) => {
  const secret = req.headers["x-internal-secret"] as string | undefined;
  try {
    assertInternalSecret(secret);
  } catch (e) {
    return reply.status(401).send({ message: "Unauthorized" });
  }
  const body = z
    .object({
      email: z.string().email(),
      name: z.string().optional(),
      image: z.string().optional(),
    })
    .parse(req.body);
  let user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: body.email, name: body.name ?? null, image: body.image ?? null },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name ?? user.name, image: body.image ?? user.image },
    });
  }
  let workspace = await prisma.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) {
    const label = body.name?.trim()?.split(/\s+/)[0];
    workspace = await prisma.workspace.create({
      data: {
        userId: user.id,
        name: label ? `${label}'s workspace` : "My workspace",
        spendMode: "STRIPE_TEST",
      },
    });
  }
  const token = signUserToken(user.id, user.email);
  return { token, userId: user.id, workspaceId: workspace.id };
});

/** Dev-only: get JWT without Google */
app.post("/api/auth/token", async (req, reply) => {
  const body = z.object({ email: z.string().email() }).parse(req.body);
  let user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    user = await prisma.user.create({ data: { email: body.email } });
    await prisma.workspace.create({
      data: { userId: user.id, name: "My workspace", spendMode: "STRIPE_TEST" },
    });
  }
  const token = signUserToken(user.id, user.email);
  return { token };
});

app.get("/api/agents", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const where = { workspaceId: ws.id };
  const total = await prisma.agent.count({ where });
  const data = await prisma.agent.findMany({
    where,
    include: { wallet: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    data: data.map((a) => agentToJson(a)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
});

app.post("/api/agents", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      templateType: z.string().optional(),
      assignedWalletId: z.string(),
      role: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      status: z.string().optional(),
    })
    .parse(req.body);
  const wallet = await prisma.wallet.findFirst({
    where: { id: body.assignedWalletId, workspaceId: ws.id },
  });
  if (!wallet) return reply.status(400).send({ message: "Wallet not found" });
  const caps = body.capabilities ?? [];
  const agent = await prisma.agent.create({
    data: {
      workspaceId: ws.id,
      walletId: wallet.id,
      name: body.name,
      description: body.description,
      templateType: body.templateType ?? "custom",
      role: body.role ?? "requester",
      capabilitiesJson: JSON.stringify(caps),
      status: body.status ?? "active",
    },
    include: { wallet: true },
  });
  return agentToJson(agent);
});

app.get("/api/agents/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const agent = await prisma.agent.findFirst({
    where: { id, workspaceId: ws.id },
    include: { wallet: true },
  });
  if (!agent) return reply.status(404).send({ message: "Not found" });
  return agentToJson(agent);
});

app.patch("/api/agents/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const agent = await prisma.agent.findFirst({ where: { id, workspaceId: ws.id } });
  if (!agent) return reply.status(404).send({ message: "Not found" });
  const body = z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      templateType: z.string().optional(),
      assignedWalletId: z.string().optional(),
      role: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      status: z.string().optional(),
    })
    .parse(req.body);
  const walletId =
    body.assignedWalletId != null
      ? (
          await prisma.wallet.findFirst({
            where: { id: body.assignedWalletId, workspaceId: ws.id },
          })
        )?.id
      : agent.walletId;
  if (body.assignedWalletId && !walletId) return reply.status(400).send({ message: "Wallet not found" });
  const caps = body.capabilities != null ? JSON.stringify(body.capabilities) : undefined;
  const updated = await prisma.agent.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description,
      templateType: body.templateType,
      walletId: walletId ?? undefined,
      role: body.role,
      capabilitiesJson: caps,
      status: body.status,
    },
    include: { wallet: true },
  });
  return agentToJson(updated);
});

app.delete("/api/agents/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const agent = await prisma.agent.findFirst({ where: { id, workspaceId: ws.id } });
  if (!agent) return reply.status(404).send({ message: "Not found" });
  await prisma.agent.delete({ where: { id } });
  return { ok: true };
});

app.post("/api/agents/:id/api-key", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const agent = await prisma.agent.findFirst({ where: { id, workspaceId: ws.id } });
  if (!agent) return reply.status(404).send({ message: "Not found" });
  await prisma.agentApiKey.updateMany({ where: { agentId: id }, data: { revokedAt: new Date() } });
  const { fullKey, keyPrefix, keyPrefixStored } = generateApiKey();
  const keyHash = await hashApiKey(fullKey);
  await prisma.agentApiKey.create({
    data: { agentId: id, keyPrefix: keyPrefixStored, keyHash },
  });
  return {
    keyPrefix,
    fullKey,
    createdAt: new Date().toISOString(),
  };
});

app.get("/api/agents/:agentId/transactions", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { agentId } = req.params as { agentId: string };
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId: ws.id } });
  if (!agent) return reply.status(404).send({ message: "Not found" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;
  const where = { workspaceId: ws.id, agentId };
  const total = await prisma.transaction.count({ where });
  const rows = await prisma.transaction.findMany({
    where,
    include: { agent: true, wallet: true, payee: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    data: rows.map((t) => transactionToJson(t)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
});

app.get("/api/wallets", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const where = { workspaceId: ws.id };
  const total = await prisma.wallet.count({ where });
  const data = await prisma.wallet.findMany({
    where,
    include: { agents: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    data: data.map((w) => walletToJson(w)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
});

app.post("/api/wallets", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = z
    .object({
      name: z.string(),
      currency: z.string().optional(),
      policy: z
        .object({
          approvalMode: z.string(),
          limits: z.object({ daily: z.number().optional(), perTransaction: z.number().optional() }),
          allowedCategories: z.array(z.string()).optional(),
          allowedVendors: z.array(z.string()).optional(),
          requireApprovedPayee: z.boolean().optional(),
          autoExecutePayout: z.boolean().optional(),
          allowedPayoutRails: z.array(z.string()).optional(),
        })
        .optional(),
      status: z.string().optional(),
    })
    .parse(req.body);
  const policyJson = JSON.stringify(
    body.policy ?? { approvalMode: "review", limits: {} }
  );
  const w = await prisma.wallet.create({
    data: {
      workspaceId: ws.id,
      name: body.name,
      currency: body.currency ?? "USD",
      balanceCents: 0,
      policyJson,
      status: body.status ?? "active",
    },
    include: { agents: true },
  });
  return walletToJson(w);
});

app.get("/api/wallets/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const w = await prisma.wallet.findFirst({
    where: { id, workspaceId: ws.id },
    include: { agents: true },
  });
  if (!w) return reply.status(404).send({ message: "Not found" });
  return walletToJson(w);
});

app.patch("/api/wallets/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const w = await prisma.wallet.findFirst({ where: { id, workspaceId: ws.id } });
  if (!w) return reply.status(404).send({ message: "Not found" });
  const body = z
    .object({
      name: z.string().optional(),
      currency: z.string().optional(),
      policy: z
        .object({
          approvalMode: z.string(),
          limits: z.object({ daily: z.number().optional(), perTransaction: z.number().optional() }),
          allowedCategories: z.array(z.string()).optional(),
          requireApprovedPayee: z.boolean().optional(),
          autoExecutePayout: z.boolean().optional(),
          allowedPayoutRails: z.array(z.string()).optional(),
        })
        .optional(),
      status: z.string().optional(),
    })
    .parse(req.body);
  const policyJson =
    body.policy != null ? JSON.stringify(body.policy) : undefined;
  const updated = await prisma.wallet.update({
    where: { id },
    data: {
      name: body.name,
      currency: body.currency,
      policyJson,
      status: body.status,
    },
    include: { agents: true },
  });
  return walletToJson(updated);
});

app.delete("/api/wallets/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const w = await prisma.wallet.findFirst({ where: { id, workspaceId: ws.id } });
  if (!w) return reply.status(404).send({ message: "Not found" });
  await prisma.wallet.delete({ where: { id } });
  return { ok: true };
});

app.post("/api/wallets/:id/fund/intent", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  if (!stripeEnabled() || !stripe) {
    return reply
      .status(503)
      .send({ message: "Stripe is not configured (set STRIPE_SECRET_KEY on custos_be)." });
  }
  const { id: walletId } = req.params as { id: string };
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, workspaceId: ws.id },
  });
  if (!wallet) return reply.status(404).send({ message: "Wallet not found" });
  const body = z.object({ amount: z.number().positive() }).parse(req.body);
  const amountCents = Math.round(body.amount * 100);
  if (amountCents < 50) {
    return reply.status(400).send({ message: "Minimum amount is $0.50" });
  }
  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: wallet.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      walletId: wallet.id,
      workspaceId: ws.id,
      userId: user.id,
    },
  });
  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
  };
});

app.post("/api/wallets/:id/fund", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const w = await prisma.wallet.findFirst({ where: { id, workspaceId: ws.id } });
  if (!w) return reply.status(404).send({ message: "Not found" });

  const allowManual = process.env.CUSTOS_ALLOW_MANUAL_FUND === "true";
  if (!allowManual) {
    return reply.status(400).send({
      message:
        "Use the in-app card flow to add funds (Stripe test). For local dev-only manual credits, set CUSTOS_ALLOW_MANUAL_FUND=true on custos_be.",
    });
  }

  const body = z.object({ amount: z.number(), reference: z.string().optional() }).parse(req.body);
  const add = Math.round(body.amount * 100);
  const updated = await prisma.wallet.update({
    where: { id },
    data: { balanceCents: { increment: add } },
    include: { agents: true },
  });
  return walletToJson(updated);
});

/** Manual treasury credit — secret code from env (see CUSTOS_CARLOS_SECRET_CODE). Independent of spend policy mode. */
app.post("/api/wallets/:id/fund/carlos", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const w = await prisma.wallet.findFirst({ where: { id, workspaceId: ws.id } });
  if (!w) return reply.status(404).send({ message: "Not found" });

  const body = z
    .object({
      amount: z.number().positive(),
      secretCode: z.string().min(1).optional(),
      adminCode: z.string().min(1).optional(),
    })
    .parse(req.body);
  const code = body.secretCode ?? body.adminCode;
  if (!code) {
    return reply.status(400).send({ message: "secretCode is required" });
  }
  const expected =
    process.env.CUSTOS_CARLOS_SECRET_CODE ??
    process.env.CUSTOS_CARLOS_ADMIN_CODE ??
    "Admin123";
  if (code !== expected) {
    return reply.status(403).send({ message: "Invalid secret code." });
  }
  const add = Math.round(body.amount * 100);
  if (add < 50) {
    return reply.status(400).send({ message: "Minimum amount is $0.50" });
  }
  const updated = await prisma.wallet.update({
    where: { id },
    data: { balanceCents: { increment: add } },
    include: { agents: true },
  });
  return walletToJson(updated);
});

app.get("/api/wallets/:walletId/transactions", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { walletId } = req.params as { walletId: string };
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, workspaceId: ws.id } });
  if (!wallet) return reply.status(404).send({ message: "Not found" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;
  const where = { workspaceId: ws.id, walletId };
  const total = await prisma.transaction.count({ where });
  const rows = await prisma.transaction.findMany({
    where,
    include: { agent: true, wallet: true, payee: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    data: rows.map((t) => transactionToJson(t)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
});

const transactionRequestBodySchema = z.object({
  agentId: z.string().optional(),
  walletId: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
  recipient: z.string().optional(),
  vendor: z.string().optional(),
  category: z.string().optional(),
  memo: z.string().optional(),
  purpose: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  payeeId: z.string().optional(),
  railType: z.string().optional(),
  sourceKind: z.string().optional(),
  evidence: z.array(z.any()).optional(),
  idempotencyKey: z.string().optional(),
  stripeConnectAccountId: z.string().optional(),
  venmoHandle: z.string().optional(),
});

function payeeToJson(p: {
  id: string;
  displayName: string;
  legalName: string | null;
  aliasesJson: string;
  defaultRail: string;
  paymentInstructions: string | null;
  stripeConnectAccountId: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  let aliases: string[] = [];
  try {
    aliases = JSON.parse(p.aliasesJson) as string[];
    if (!Array.isArray(aliases)) aliases = [];
  } catch {
    aliases = [];
  }
  return {
    id: p.id,
    displayName: p.displayName,
    legalName: p.legalName ?? undefined,
    aliases,
    defaultRail: p.defaultRail,
    paymentInstructions: p.paymentInstructions ?? undefined,
    stripeConnectAccountId: p.stripeConnectAccountId ?? undefined,
    notes: p.notes ?? undefined,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

app.get("/api/payees", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const rows = await prisma.approvedPayee.findMany({
    where: { workspaceId: ws.id },
    orderBy: { displayName: "asc" },
  });
  return { data: rows.map(payeeToJson) };
});

app.post("/api/payees", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = z
    .object({
      displayName: z.string().min(1),
      legalName: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      defaultRail: z.string().optional(),
      paymentInstructions: z.string().optional(),
      notes: z.string().optional(),
      stripeConnectAccountId: z.string().optional(),
      active: z.boolean().optional(),
    })
    .parse(req.body);
  const p = await prisma.approvedPayee.create({
    data: {
      workspaceId: ws.id,
      displayName: body.displayName.trim(),
      legalName: body.legalName?.trim() || null,
      aliasesJson: JSON.stringify(body.aliases ?? []),
      defaultRail: body.defaultRail ?? "merchant_card",
      paymentInstructions: body.paymentInstructions?.trim() || null,
      stripeConnectAccountId: body.stripeConnectAccountId?.trim() || null,
      notes: body.notes?.trim() || null,
      active: body.active ?? true,
    },
  });
  return payeeToJson(p);
});

app.patch("/api/payees/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const existing = await prisma.approvedPayee.findFirst({ where: { id, workspaceId: ws.id } });
  if (!existing) return reply.status(404).send({ message: "Not found" });
  const body = z
    .object({
      displayName: z.string().min(1).optional(),
      legalName: z.string().optional().nullable(),
      aliases: z.array(z.string()).optional(),
      defaultRail: z.string().optional(),
      paymentInstructions: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      stripeConnectAccountId: z.string().optional().nullable(),
      active: z.boolean().optional(),
    })
    .parse(req.body);
  const p = await prisma.approvedPayee.update({
    where: { id },
    data: {
      displayName: body.displayName?.trim(),
      legalName: body.legalName === undefined ? undefined : body.legalName?.trim() ?? null,
      aliasesJson: body.aliases !== undefined ? JSON.stringify(body.aliases) : undefined,
      defaultRail: body.defaultRail,
      paymentInstructions:
        body.paymentInstructions === undefined ? undefined : body.paymentInstructions?.trim() ?? null,
      stripeConnectAccountId:
        body.stripeConnectAccountId === undefined
          ? undefined
          : body.stripeConnectAccountId?.trim() || null,
      notes: body.notes === undefined ? undefined : body.notes?.trim() ?? null,
      active: body.active,
    },
  });
  return payeeToJson(p);
});

app.delete("/api/payees/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const existing = await prisma.approvedPayee.findFirst({ where: { id, workspaceId: ws.id } });
  if (!existing) return reply.status(404).send({ message: "Not found" });
  await prisma.approvedPayee.delete({ where: { id } });
  return { ok: true };
});

app.post("/api/transactions/request", async (req, reply) => {
  const auth = req.headers.authorization;
  const agentKey = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!agentKey.startsWith("custos_")) {
    return reply.status(401).send({ message: "Agent API key required (Bearer custos_xxx)" });
  }
  const agentRow = await verifyApiKey(agentKey);
  if (!agentRow) return reply.status(401).send({ message: "Invalid API key" });

  const body = transactionRequestBodySchema.parse(req.body);

  if (body.agentId && body.agentId !== agentRow.id) {
    return reply.status(401).send({ message: "agentId mismatch" });
  }

  try {
    return await submitAgentTransactionRequest(
      {
        id: agentRow.id,
        workspaceId: agentRow.workspaceId,
        walletId: agentRow.walletId,
        name: agentRow.name,
      },
      body
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg === "Wallet not found" ||
      msg === "walletId must match agent wallet" ||
      msg === "Invalid payeeId for this workspace"
    ) {
      return reply.status(400).send({ message: msg });
    }
    req.log.error(e);
    return reply.status(500).send({ message: msg });
  }
});

/** Dashboard / invoice UI: same payload as agent API, authorized by user JWT. */
app.post("/api/transactions/request-as-user", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = transactionRequestBodySchema.parse(req.body);
  if (!body.agentId?.trim()) {
    return reply.status(400).send({ message: "agentId is required" });
  }
  const agentRow = await prisma.agent.findFirst({
    where: { id: body.agentId.trim(), workspaceId: ws.id },
  });
  if (!agentRow) return reply.status(400).send({ message: "Agent not found in workspace" });
  if (body.walletId && body.walletId !== agentRow.walletId) {
    return reply.status(400).send({ message: "walletId must match agent's assigned wallet" });
  }
  try {
    return await submitAgentTransactionRequest(
      {
        id: agentRow.id,
        workspaceId: agentRow.workspaceId,
        walletId: agentRow.walletId,
        name: agentRow.name,
      },
      body
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg === "Wallet not found" ||
      msg === "walletId must match agent wallet" ||
      msg === "Invalid payeeId for this workspace"
    ) {
      return reply.status(400).send({ message: msg });
    }
    req.log.error(e);
    return reply.status(500).send({ message: msg });
  }
});

app.get("/api/transactions", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const where: Record<string, unknown> = { workspaceId: ws.id };
  const status = searchParams.get("status");
  if (status) where.status = status;
  const agentId = searchParams.get("agentId");
  if (agentId) where.agentId = agentId;
  const walletId = searchParams.get("walletId");
  if (walletId) where.walletId = walletId;
  const total = await prisma.transaction.count({ where });
  const rows = await prisma.transaction.findMany({
    where,
    include: { agent: true, wallet: true, payee: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    data: rows.map((t) => transactionToJson(t)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
});

app.get("/api/transactions/:id", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const tx = await prisma.transaction.findFirst({
    where: { id, workspaceId: ws.id },
    include: { agent: true, wallet: true, payee: true },
  });
  if (!tx) return reply.status(404).send({ message: "Not found" });
  return transactionToJson(tx);
});

app.patch("/api/transactions/:id/review", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { id } = req.params as { id: string };
  const tx = await prisma.transaction.findFirst({
    where: { id, workspaceId: ws.id },
    include: { agent: true, wallet: true, payee: true },
  });
  if (!tx) return reply.status(404).send({ message: "Not found" });
  const body = z
    .object({
      decision: z.enum(["approve", "reject"]),
      note: z.string().optional(),
    })
    .parse(req.body);
  const status = body.decision === "approve" ? "approved" : "blocked";
  const reviewState = body.decision === "approve" ? "approved" : "rejected";
  const audit = JSON.parse(tx.auditJson ?? "[]") as object[];
  audit.push({
    id: String(audit.length + 1),
    timestamp: new Date().toISOString(),
    type: "human",
    action: `Human review: ${body.decision}`,
    actor: user.email,
    detail: body.note,
  });
  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      status,
      reviewState,
      auditJson: JSON.stringify(audit),
    },
    include: { agent: true, wallet: true, payee: true },
  });
  return transactionToJson(updated);
});

app.get("/api/review-queue", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const { searchParams } = new URL(req.url, "http://localhost");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const where = { workspaceId: ws.id, status: "pending_review" as const };
  const total = await prisma.transaction.count({ where });
  const rows = await prisma.transaction.findMany({
    where,
    include: { agent: true, wallet: true, payee: true },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const now = Date.now();
  const data = rows.map((t) => ({
    transactionId: t.id,
    transaction: transactionToJson(t),
    ageMinutes: Math.floor((now - t.createdAt.getTime()) / 60000),
    reviewerStatus: "pending" as const,
  }));
  return { data, total };
});

app.get("/api/templates", async () => {
  return {
    data: [
      {
        id: "invoice",
        name: "Invoice",
        description: "Parse invoices and request payment",
        status: "available",
      },
    ],
  };
});

app.get("/api/templates/invoice", async () => ({
  id: "invoice",
  name: "Invoice",
  description: "Upload invoice screenshots; extract fields and submit spend requests.",
  expectedInputs: ["screenshot"],
  permissionsNeeded: ["spend"],
}));

await mkdir(UPLOAD_ROOT, { recursive: true });

app.post("/api/invoice/upload", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const mp = await req.file();
  if (!mp) return reply.status(400).send({ message: "No file" });
  const buf = await mp.toBuffer();
  const id = `inv_${Date.now()}`;
  const fname = `${id}_${(mp.filename ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = join(UPLOAD_ROOT, fname);
  await writeFile(path, buf);
  await prisma.uploadedFile.create({
    data: { id, path, mimeType: mp.mimetype },
  });
  return { fileId: id, url: undefined };
});

app.post("/api/invoice/extract", async (req, reply) => {
  const user = await requireUser(req.headers.authorization);
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return reply.status(404).send({ message: "No workspace" });
  const body = z.object({ fileId: z.string() }).parse(req.body);
  const file = await prisma.uploadedFile.findUnique({ where: { id: body.fileId } });
  if (!file) return reply.status(404).send({ message: "File not found" });

  const agentUrl = process.env.CUSTOS_INVOICE_AGENT_URL;
  if (agentUrl) {
    const buf = await readFile(file.path);
    const form = new FormData();
    form.append(
      "file",
      new Blob([buf], { type: file.mimeType ?? "image/png" }),
      "invoice.png"
    );
    const r = await fetch(agentUrl, { method: "POST", body: form });
    if (!r.ok) {
      return reply.status(502).send({ message: await r.text() });
    }
    return await r.json();
  }

  // Mock extraction when no invoice agent is configured
  return {
    vendor: "Extracted Vendor (mock)",
    invoiceNumber: `INV-${body.fileId.slice(-6)}`,
    amount: 1250,
    dueDate: new Date().toISOString().slice(0, 10),
    memo: "Mock extraction — set CUSTOS_INVOICE_AGENT_URL for real OCR",
    confidence: 0.5,
    sourceFileId: body.fileId,
    railType: "merchant_card",
  };
});

const port = Number(process.env.PORT ?? 4000);
try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`custos_be listening on ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
