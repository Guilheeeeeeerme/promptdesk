import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ConversationsService } from './conversations.service';
import type { ListConversationsFilters } from './conversations.service';
import { CreateAgentMessageDto } from './dto/create-agent-message.dto';
import { CreateConversationDto, UpdateConversationDto } from './dto/create-chat.dto';

@Controller('chat/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('pinned') pinned?: string,
    @Query('archived') archived?: string,
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const filters: ListConversationsFilters = {
      status,
      pinned,
      archived,
      q,
      limit,
      offset,
    };
    return this.conversationsService.list(req.session, filters);
  }

  /** Man-in-the-middle effectiveness panel (past 7 days). Static route — must precede ':id'. */
  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    return this.conversationsService.summary(req.session);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateConversationDto,
  ) {
    return this.conversationsService.create(req.session, body);
  }

  @Get(':id')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.conversationsService.detail(req.session, id);
  }

  @Get(':id/messages')
  messages(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.conversationsService.listMessages(req.session, id);
  }

  /** Human-in-the-loop: platform admin posts a manual reply in the thread. */
  @Post(':id/messages')
  agentMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CreateAgentMessageDto,
  ) {
    return this.conversationsService.createAgentMessage(req.session, id, body);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateConversationDto,
  ) {
    return this.conversationsService.update(req.session, id, body);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.conversationsService.softDelete(req.session, id);
  }
}
