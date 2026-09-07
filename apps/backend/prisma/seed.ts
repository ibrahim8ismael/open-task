// B0/B5 seed: default states + demo workspace + ADMIN_EMAILS superadmin.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { DEFAULT_STATES } from "../src/common/utils/default-states";
import { uniqueSuffix } from "../src/common/utils/roles";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

/** Promote every email in ADMIN_EMAILS (comma-separated) to superuser; bootstrap one with a password if missing. */
async function seedAdmins(): Promise<void> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  if (!emails.length) return;
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const found = await prisma.user.findMany({ where: { email: { in: emails } } });
  const byEmail = new Map(found.map((u) => [u.email, u]));
  await Promise.all(
    emails.map(async (email) => {
      const existing = byEmail.get(email);
      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: { isSuperuser: true, isActive: true } });
        console.log(`admin ensured: ${email}`);
        return;
      }
      if (!initialPassword || initialPassword.length < 12) {
        console.warn(`skip ${email}: not found and ADMIN_INITIAL_PASSWORD missing/short (>=12)`);
        return;
      }
      const base = email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "admin";
      const user = await prisma.user.create({
        data: {
          username: `${base}-${uniqueSuffix()}`,
          email,
          displayName: email,
          passwordHash: await hash(initialPassword, 12),
          isSuperuser: true,
        },
      });
      await prisma.profile.create({ data: { userId: user.id } });
      console.log(`admin created: ${email}`);
    }),
  );
}

async function main(): Promise<void> {
  console.log(`seed: ${DEFAULT_STATES.length} default states defined (states are seeded per-project on create)`);
  await seedAdmins();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
