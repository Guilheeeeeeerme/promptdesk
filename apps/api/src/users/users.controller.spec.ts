import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
jest.mock('../auth/session.service', () => ({
  SessionService: class SessionService {},
}));
jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));
import { AuthGuard } from '../auth/auth.guard';
import { SessionService } from '../auth/session.service';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersController } from './users.controller';
import { UsersModule } from './users.module';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('rejects unauthenticated requests before invoking the service', async () => {
    const sessions = { get: jest.fn().mockResolvedValue(null) };
    const guard = new AuthGuard(sessions as never);
    const request = { headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('forwards the authenticated session and validated create DTO', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const session = {
      userId: 'root-1',
      role: 'root',
      activeCompanyId: 'company-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
    } as const;
    const moduleFixture = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: AuthGuard, useValue: { canActivate: () => true } },
        { provide: SessionService, useValue: {} },
      ],
    }).compile();
    const controller = moduleFixture.get(UsersController);
    const req = { session } as never;

    await expect(
      controller.create(req, {
        email: 'new@example.com',
        name: 'New User',
        role: 'agent',
        password: 'password123',
      }),
    ).resolves.toEqual({ id: 'user-1' });
    expect(service.create).toHaveBeenCalledWith(session, {
      email: 'new@example.com',
      name: 'New User',
      role: 'agent',
      password: 'password123',
    });
  });

  it('rejects unknown DTO fields through the global validation pipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          email: 'new@example.com',
          name: 'New User',
          role: 'agent',
          password: 'password123',
          companyId: 'client-selected-company',
        },
        { type: 'body', metatype: CreateUserDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('includes UsersModule in the application dependency graph', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, RedisModule, UsersModule],
    }).compile();

    expect(moduleFixture.get(UsersController)).toBeInstanceOf(UsersController);
    await moduleFixture.close();
  });
});
