import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const LOCAL_FALLBACK_EMAIL = 'root@example.com';
const LOCAL_FALLBACK_PASSWORD = 'Password123!';

export async function seedPlatform(client: PrismaClient = prisma): Promise<void> {
  const email =
    process.env.DEV_ROOT_EMAIL?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : LOCAL_FALLBACK_EMAIL);
  const password =
    process.env.DEV_ROOT_PASSWORD?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : LOCAL_FALLBACK_PASSWORD);

  if (!email || !password) {
    throw new Error(
      'DEV_ROOT_EMAIL and DEV_ROOT_PASSWORD are required for platform bootstrap',
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await client.user.upsert({
    where: { email },
    update: {
      name: 'Root User',
      role: Role.root,
      companyId: null,
      passwordHash,
    },
    create: {
      email,
      name: 'Root User',
      role: Role.root,
      companyId: null,
      passwordHash,
    },
  });

  // Local-only companion admin when using fallback credentials.
  if (email === LOCAL_FALLBACK_EMAIL) {
    await client.user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        name: 'Admin User',
        role: Role.admin,
        companyId: null,
        passwordHash,
      },
      create: {
        email: 'admin@example.com',
        name: 'Admin User',
        role: Role.admin,
        companyId: null,
        passwordHash,
      },
    });
  }

  console.log(`Platform seed complete: root=${email}`);
}

if (require.main === module) {
  seedPlatform()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
