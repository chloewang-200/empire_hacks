import { prisma } from "./prisma.js";
import { stripe, stripeEnabled } from "./stripe.js";

export async function ensureStripeCustomerForWallet(opts: {
  walletId: string;
  workspaceId: string;
  userEmail: string;
}): Promise<string> {
  if (!stripeEnabled() || !stripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  }
  const wallet = await prisma.wallet.findFirst({
    where: { id: opts.walletId, workspaceId: opts.workspaceId },
  });
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.stripeCustomerId) return wallet.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: opts.userEmail,
    metadata: { walletId: wallet.id, workspaceId: wallet.workspaceId },
  });
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}
