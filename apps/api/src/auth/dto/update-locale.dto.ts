import { IsIn } from 'class-validator';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../common/supported-locales';

export class UpdateLocaleDto {
  @IsIn(SUPPORTED_LOCALES)
  locale!: SupportedLocale;
}
