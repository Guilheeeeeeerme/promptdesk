import { IsIn, IsOptional } from 'class-validator';
import { SUPPORTED_LANGUAGES } from './company-language';

export class UpdateCompanyDto {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  defaultLanguage?: string;
}
