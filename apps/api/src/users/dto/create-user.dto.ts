import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  Matches,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import type { SessionRole } from '../../auth/session.types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  name!: string;

  @IsEnum(Role)
  role!: SessionRole;

  @IsString()
  @MinLength(8)
  password!: string;
}
