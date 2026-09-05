import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { SessionRole } from '../../auth/session.types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(Role)
  role!: SessionRole;

  @IsString()
  @MinLength(8)
  password!: string;
}
