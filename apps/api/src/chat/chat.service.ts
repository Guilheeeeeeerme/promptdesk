import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { SessionData } from '../auth/session.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserMessage(session: SessionData, content: string) {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        companyId: session.activeCompanyId,
        userId: session.userId,
        role: MessageRole.user,
        content,
      },
    });

    return {
      status: 'accepted',
      reply: null,
      message: {
        id: message.id,
        content: message.content,
        role: message.role,
        createdAt: message.createdAt,
        companyId: message.companyId,
      },
    };
  }
}
