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
  latestValidVersion?: number | null;
  latestValidVersionHash?: string | null;
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
  status: GuidelineValidationStatus;
  validationReason?: string | null;
  validationStartedAt?: string | null;
  validatedAt?: string | null;
}

export interface GuidelineVersionDetail extends GuidelineVersionMeta {
  content: string;
}

export interface GuidelineValidationEvent {
  type: 'guideline_validation';
  companyId: string;
  versionId: string;
  version: number;
  status: GuidelineValidationStatus;
  reason?: string | null;
  activeVersion?: number | null;
  occurredAt: string;
}

export type GuidelineValidationStatus =
  | 'pending'
  | 'processing'
  | 'valid'
  | 'invalid'
  | 'provider_error'
  | 'cancelled';

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
