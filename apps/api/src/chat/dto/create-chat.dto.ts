import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const CONVERSATION_STATUSES = [
  'open',
  'solved',
  'not_solved',
  'wont_solve',
] as const;

export type ConversationStatusDto = (typeof CONVERSATION_STATUSES)[number];

/** Agents (owners) may pick only these; wont_solve is platform-only. */
export const AGENT_STATUSES = ['open', 'solved', 'not_solved'] as const;

export type AgentStatusDto = (typeof AGENT_STATUSES)[number];
export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsIn(CONVERSATION_STATUSES)
  status?: ConversationStatusDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;
}

export class CreateChatDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Optional idempotent-send key (or `Idempotency-Key` header); max 64 chars. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
