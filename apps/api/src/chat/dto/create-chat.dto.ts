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
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../common/supported-locales';
import { MAX_CHAT_MESSAGE_LENGTH } from '../chat.guards';

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
  @MaxLength(MAX_CHAT_MESSAGE_LENGTH)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Optional idempotent-send key (or `Idempotency-Key` header); max 64 chars. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;

  /** Client UI locale; used only when the user has no saved preference. */
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}
