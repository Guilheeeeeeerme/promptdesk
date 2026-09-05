import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { SessionService } from '../auth/session.service';
import { ConfigService } from '@nestjs/config';
import {
  CHAT_EVENTS_CHANNEL,
  type ChatChannelEvent,
  type ChatJobEvent,
} from './chat.constants';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  private subscriber: Redis | null = null;

  constructor(
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.subscriber = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });

    void this.subscriber.subscribe(CHAT_EVENTS_CHANNEL, (err) => {
      if (err) {
        this.logger.error(`Failed to subscribe ${CHAT_EVENTS_CHANNEL}`, err);
      }
    });

    this.subscriber.on('message', (channel, raw) => {
      if (channel !== CHAT_EVENTS_CHANNEL) return;
      try {
        const event = JSON.parse(raw) as ChatChannelEvent;
        if ('type' in event && event.type === 'agent_message') {
          this.server.to(`user:${event.ownerId}`).emit('agent:message', event);
          return;
        }
        if ('type' in event && event.type === 'conversation_update') {
          this.server
            .to(`user:${event.ownerId}`)
            .emit('conversation:update', event);
          return;
        }
        this.server
          .to(`user:${(event as ChatJobEvent).userId}`)
          .emit('job:update', event);
      } catch (err) {
        this.logger.warn(`Invalid chat event payload: ${String(err)}`);
      }
    });
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.emit('error', { message: 'Missing session token' });
      client.disconnect(true);
      return;
    }

    const session = await this.sessions.get(token);
    if (!session) {
      client.emit('error', { message: 'Invalid or expired session' });
      client.disconnect(true);
      return;
    }

    client.data.session = session;
    client.data.token = token;
    await client.join(`user:${session.userId}`);
    client.emit('ready', {
      status: 'ready',
      activeCompanyId: session.activeCompanyId,
    });
  }

  handleDisconnect(_client: Socket) {
    // Client-driven lifecycle; rooms cleaned by Socket.IO
  }
}
