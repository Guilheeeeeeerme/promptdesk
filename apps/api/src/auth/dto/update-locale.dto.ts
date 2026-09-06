import { IsIn } from 'class-validator';

export class UpdateLocaleDto {
  @IsIn(['en-US', 'pt-BR'])
  locale!: 'en-US' | 'pt-BR';
}
