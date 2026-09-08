import { PrismaClient, Role } from '@prisma/client';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Password123!';

function readGuideline(fileName: string): string {
  const filePath = path.join(__dirname, 'seed-guidelines', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

// Trusted seed fixture only: repo-controlled guidelines under seed-guidelines/
// are pre-reviewed and may be marked valid without the async LLM validator.
// Runtime create/upload paths must quarantine as pending and activate only
// after guideline-validation.lifecycle succeeds — never copy this shortcut.
async function ensureInitialGuidelineVersion(
  companyId: string,
  content: string,
  fileName: string,
): Promise<void> {
  const hasVersions = await prisma.guidelineVersion.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (hasVersions) return;

  const buffer = Buffer.from(content, 'utf8');
  const version = await prisma.guidelineVersion.create({
    data: {
      companyId,
      version: 1,
      content,
      fileName,
      contentHash: createHash('sha256').update(buffer).digest('hex'),
      byteSize: buffer.byteLength,
      // Trusted fixture (see comment above) — not a runtime create bypass.
      status: 'valid',
      validatedAt: new Date(),
    },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: { currentGuidelineVersionId: version.id },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const bookshopGuidelines = readGuideline('bookshop.txt');
  const vpnGuidelines = readGuideline('vpn.txt');
  const now = new Date();

  const bookshop = await prisma.company.upsert({
    where: { name: 'Bookshop' },
    update: {
      guidelineText: bookshopGuidelines,
      guidelineFileName: 'bookshop_support_guidelines.txt',
      guidelineUpdatedAt: now,
    },
    create: {
      name: 'Bookshop',
      guidelineText: bookshopGuidelines,
      guidelineFileName: 'bookshop_support_guidelines.txt',
      guidelineUpdatedAt: now,
    },
  });

  const vpn = await prisma.company.upsert({
    where: { name: 'VPN SaaS' },
    update: {
      guidelineText: vpnGuidelines,
      guidelineFileName: 'vpn_support_guidelines.txt',
      guidelineUpdatedAt: now,
    },
    create: {
      name: 'VPN SaaS',
      guidelineText: vpnGuidelines,
      guidelineFileName: 'vpn_support_guidelines.txt',
      guidelineUpdatedAt: now,
    },
  });

  await ensureInitialGuidelineVersion(
    bookshop.id,
    bookshopGuidelines,
    'bookshop_support_guidelines.txt',
  );
  await ensureInitialGuidelineVersion(
    vpn.id,
    vpnGuidelines,
    'vpn_support_guidelines.txt',
  );

  const users: Array<{
    email: string;
    name: string;
    role: Role;
    companyId: string | null;
  }> = [
    {
      email: 'root@example.com',
      name: 'Root User',
      role: Role.root,
      companyId: null,
    },
    {
      email: 'admin@example.com',
      name: 'Admin User',
      role: Role.admin,
      companyId: null,
    },
    {
      email: 'manager.bookshop@example.com',
      name: 'Bookshop Manager',
      role: Role.manager,
      companyId: bookshop.id,
    },
    {
      email: 'agent.bookshop@example.com',
      name: 'Bookshop Agent',
      role: Role.agent,
      companyId: bookshop.id,
    },
    {
      email: 'manager.vpn@example.com',
      name: 'VPN Manager',
      role: Role.manager,
      companyId: vpn.id,
    },
    {
      email: 'agent.vpn@example.com',
      name: 'VPN Agent',
      role: Role.agent,
      companyId: vpn.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        passwordHash,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        passwordHash,
      },
    });
  }

  console.log(
    'Seed complete: Bookshop, VPN SaaS, guidelines (v1 history), 6 users',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
