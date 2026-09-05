import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { SessionRole } from '../../auth/session.types';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: SessionRole;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
