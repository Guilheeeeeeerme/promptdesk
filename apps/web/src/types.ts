export type {
  LoginResponse,
  Role,
  SessionPayload,
  SessionUser as User,
} from '@shared/auth';
export { isPlatformRole } from '@shared/auth';

export interface Company {
  id: string;
  name: string;
  createdAt?: string;
  defaultLanguage?: string;
  guidelineFileName?: string | null;
  guidelineUpdatedAt?: string | null;
  hasGuidelines?: boolean;
  messageCount?: number;
}

export interface CompanyDetail extends Company {
  guidelineText?: string | null;
}
