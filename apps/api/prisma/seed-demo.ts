import { PrismaClient, Role } from '@prisma/client';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const DEMO_COMPANY_NAME = 'Acme Demo Co';
export const DEMO_EMAIL = 'demo@acme-demo.local';
export const DEMO_AGENT_EMAIL = 'agent@acme-demo.local';

const DEFAULT_DEMO_PASSWORD = 'Password123!';

const DEMO_GUIDELINE = [
  'Acme Demo Co — Support Guidelines',
  '',
  '- Refunds: available within 14 days of purchase; resolve instantly via dashboard.',
  '- Shipping: orders ship in 1-2 business days; free over $50.',
  '- Account issues: escalate to the platform team (in the demo, explain this is AI-answered).',
  '- Always stay friendly, concise, and respond in English.',
].join('\n');

function demoPassword(): string {
  return process.env.DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
}

async function ensureInitialGuidelineVersion(
  client: PrismaClient,
  companyId: string,
  content: string,
  fileName: string,
): Promise<void> {
  const hasVersions = await client.guidelineVersion.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (hasVersions) return;

  const buffer = Buffer.from(content, 'utf8');
  const version = await client.guidelineVersion.create({
    data: {
      companyId,
      version: 1,
      content,
      fileName,
      contentHash: createHash('sha256').update(buffer).digest('hex'),
      byteSize: buffer.byteLength,
      status: 'valid',
      validatedAt: new Date(),
    },
  });

  await client.company.update({
    where: { id: companyId },
    data: {
      currentGuidelineVersionId: version.id,
      guidelineText: content,
      guidelineFileName: fileName,
      guidelineUpdatedAt: new Date(),
    },
  });
}

export async function seedDemo(client: PrismaClient = prisma): Promise<void> {
  const passwordHash = await bcrypt.hash(demoPassword(), 10);

  const company = await client.company.upsert({
    where: { name: DEMO_COMPANY_NAME },
    update: {},
    create: { name: DEMO_COMPANY_NAME },
  });

  await ensureInitialGuidelineVersion(
    client,
    company.id,
    DEMO_GUIDELINE,
    'demo-guideline.md',
  );

  await client.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: 'Demo Manager',
      role: Role.manager,
      companyId: company.id,
      passwordHash,
    },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Manager',
      role: Role.manager,
      companyId: company.id,
      passwordHash,
    },
  });

  await client.user.upsert({
    where: { email: DEMO_AGENT_EMAIL },
    update: {
      name: 'Demo Agent',
      role: Role.agent,
      companyId: company.id,
      passwordHash,
    },
    create: {
      email: DEMO_AGENT_EMAIL,
      name: 'Demo Agent',
      role: Role.agent,
      companyId: company.id,
      passwordHash,
    },
  });

  console.log(
    `Demo seed complete: ${DEMO_COMPANY_NAME}, ${DEMO_EMAIL}, ${DEMO_AGENT_EMAIL}`,
  );
}

if (require.main === module) {
  seedDemo()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
