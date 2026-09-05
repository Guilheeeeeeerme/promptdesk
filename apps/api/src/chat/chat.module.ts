import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { CHAT_GENERATE_QUEUE } from './chat.constants';

@Module({
  imports: [
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: CHAT_GENERATE_QUEUE,
    }),
  ],
  controllers: [ChatController, ConversationsController],
  providers: [ChatService, ConversationsService, ChatGateway],
})
export class ChatModule {}
