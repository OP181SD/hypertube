import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as argon2 from "argon2";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed OAuth client for development
  await prisma.oAuthClient.upsert({
    where: { clientId: "hypertube-web" },
    update: {},
    create: {
      clientId: "hypertube-web",
      clientSecret: "hypertube-web-secret",
      name: "Hypertube Web Client",
    },
  });

  // Seed a demo user
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
