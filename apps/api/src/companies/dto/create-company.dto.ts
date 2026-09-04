import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_LANGUAGES } from './company-language';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  defaultLanguage?: string;
}
