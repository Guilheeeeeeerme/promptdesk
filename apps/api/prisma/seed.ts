import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const bookshop = await prisma.company.upsert({
    where: { name: 'Bookshop' },
    update: {},
    create: { name: 'Bookshop' },
  });

  const vpn = await prisma.company.upsert({
    where: { name: 'VPN SaaS' },
    update: {},
    create: { name: 'VPN SaaS' },
  });

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

  console.log('Seed complete: Bookshop, VPN SaaS, 6 users');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
