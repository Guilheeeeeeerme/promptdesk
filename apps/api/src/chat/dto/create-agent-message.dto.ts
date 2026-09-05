import { IsString, MaxLength, MinLength } from 'class-validator';

/** Manual human reply from a platform admin (man in the middle). */
export class CreateAgentMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;
}
