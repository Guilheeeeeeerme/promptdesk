import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  list(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.chatService.listMessages(req.session, limit);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateChatDto,
  ) {
    return this.chatService.createUserMessage(req.session, body.message);
  }

  @Post('messages/:id/retry')
  retry(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.chatService.retryAssistantMessage(req.session, id);
  }

  @Post('messages/:id/stop')
  stop(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.chatService.stopAssistantMessage(req.session, id);
  }
}
