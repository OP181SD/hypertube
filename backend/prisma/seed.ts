import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as argon2 from "argon2";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {

  const clientId = process.env.OAUTH_CLIENT_ID ?? "hypertube-web";
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error(
      "OAUTH_CLIENT_SECRET is missing from .env — API clients could not authenticate.",
    );
  }

  const oauthClientSecretHash = await argon2.hash(clientSecret);
  await prisma.oAuthClient.upsert({
    where: { clientId },
    update: { clientSecret: oauthClientSecretHash },
    create: {
      clientId,
      clientSecret: oauthClientSecretHash,
      name: "Hypertube API Client",
    },
  });

  const passwordHash = await argon2.hash("DemoPass123!");
  await prisma.user.upsert({
    where: { email: "demo@hypertube.dev" },
    update: {},
    create: {
      email: "demo@hypertube.dev",
      username: "demo",
      firstName: "Demo",
      lastName: "User",
      passwordHash,
      emailVerified: true,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
