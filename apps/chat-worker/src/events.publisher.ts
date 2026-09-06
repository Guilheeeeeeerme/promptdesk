import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  CHAT_EVENTS_CHANNEL,
  type ChatJobEvent,
  type GuidelineValidationEvent,
} from './chat.constants';

@Injectable()
export class EventsPublisher implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async publish(event: ChatJobEvent | GuidelineValidationEvent): Promise<void> {
    await this.client.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  }
}
