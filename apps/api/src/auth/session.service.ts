import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { SessionData, SessionRole } from './session.types';

@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.ttlSeconds = Number(
      this.config.get<string>('SESSION_TTL_SECONDS', '86400'),
    );
  }

  private key(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async create(params: {
    userId: string;
    role: SessionRole;
    activeCompanyId: string | null;
  }): Promise<{ token: string; session: SessionData }> {
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const session: SessionData = {
      userId: params.userId,
      role: params.role,
      activeCompanyId: params.activeCompanyId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis
      .getClient()
      .set(this.key(token), JSON.stringify(session), 'EX', this.ttlSeconds);

    return { token, session };
  }

  async get(token: string): Promise<SessionData | null> {
    const raw = await this.redis.getClient().get(this.key(token));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionData;
  }

  async updateActiveCompany(
    token: string,
    activeCompanyId: string,
  ): Promise<SessionData | null> {
    const session = await this.get(token);
    if (!session) {
      return null;
    }

    const ttl = await this.redis.getClient().ttl(this.key(token));
    const updated: SessionData = {
      ...session,
      activeCompanyId,
    };

    const expireSeconds = ttl > 0 ? ttl : this.ttlSeconds;
    await this.redis
      .getClient()
      .set(
        this.key(token),
        JSON.stringify(updated),
        'EX',
        expireSeconds,
      );

    return updated;
  }

  async destroy(token: string): Promise<void> {
    await this.redis.getClient().del(this.key(token));
  }

  async destroyForUser(userId: string): Promise<void> {
    const client = this.redis.getClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        'session:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await client.get(key);
        if (!raw) continue;
        try {
          const session = JSON.parse(raw) as Partial<SessionData>;
          if (session.userId === userId) {
            await client.del(key);
          }
        } catch {
          // Ignore malformed or concurrently expired session records.
        }
      }
    } while (cursor !== '0');
  }
}
