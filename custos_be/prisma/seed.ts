import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Optional local demo account — user + workspace only (no default wallet/agent). */
async function main() {
  const email = "demo@custos.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: "Demo User" },
    });
  }
  const ws = await prisma.workspace.findFirst({ where: { userId: user.id } });
  if (!ws) {
    await prisma.workspace.create({
      data: { userId: user.id, name: "Demo Workspace", spendMode: "STRIPE_TEST" },
    });
  }
  console.log("Seed OK:", { user: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
