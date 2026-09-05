import { Global, Module } from '@nestjs/common';
import { ChatPrismaService } from './chat-prisma.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, ChatPrismaService],
  exports: [PrismaService, ChatPrismaService],
})
export class PrismaModule {}
