import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly sessions: SessionService) {}

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
    client.emit('ready', {
      status: 'ready',
      activeCompanyId: session.activeCompanyId,
      note: 'AI replies not implemented yet',
    });
  }

  @SubscribeMessage('chat')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { message?: string },
  ) {
    if (!client.data.session) {
      return { status: 'unauthorized' };
    }

    client.emit('ack', {
      status: 'ack',
      message: body?.message ?? null,
      reply: null,
      note: 'Skeleton WebSocket — no AI response yet',
    });

    return { status: 'ack' };
  }
}
