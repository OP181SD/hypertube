import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as argon2 from "argon2";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_TEST ||
    "postgresql://hypertube_test:hypertube_test_secret@localhost:5433/hypertube_test",
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function cleanDatabase() {
  await prisma.$executeRawUnsafe('DELETE FROM "password_resets"');
  await prisma.$executeRawUnsafe('DELETE FROM "refresh_tokens"');
  await prisma.$executeRawUnsafe('DELETE FROM "comments"');
  await prisma.$executeRawUnsafe('DELETE FROM "watch_history"');
  await prisma.$executeRawUnsafe('DELETE FROM "torrents"');
  await prisma.$executeRawUnsafe('DELETE FROM "movies"');
  await prisma.$executeRawUnsafe('DELETE FROM "oauth_clients"');
  await prisma.$executeRawUnsafe('DELETE FROM "users"');
}

export async function createOAuthClient() {
  const clientSecretHash = await argon2.hash("test-secret");
  return prisma.oAuthClient.create({
    data: {
      clientId: "test-client",
      clientSecret: clientSecretHash,
      name: "Test Client",
    },
  });
}

export { prisma };
