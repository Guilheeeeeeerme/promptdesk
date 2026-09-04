import { IsString, MinLength } from 'class-validator';

export class UpdateContextDto {
  @IsString()
  @MinLength(1)
  companyId!: string;
}
