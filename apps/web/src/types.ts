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
  guidelineFileName?: string | null;
  guidelineUpdatedAt?: string | null;
  currentVersion?: number | null;
  hasGuidelines?: boolean;
  messageCount?: number;
}

export interface CompanyDetail extends Company {
  guidelineText?: string | null;
}

export interface GuidelineVersionMeta {
  id: string;
  version: number;
  fileName?: string | null;
  contentHash: string;
  byteSize?: number | null;
  createdAt: string;
}

export interface UserView {
  id: string;
  email: string;
  name: string;
  role: import('@shared/auth').Role;
  companyId: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserView['role'];
  password: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserView['role'];
  password?: string;
}
