export type SessionRole = 'root' | 'admin' | 'manager' | 'agent' | 'owner';

export interface SessionData {
  userId: string;
  role: SessionRole;
  activeCompanyId: string | null;
  createdAt: string;
  expiresAt: string;
}

export const PLATFORM_ROLES: SessionRole[] = ['root', 'admin'];

export function isPlatformRole(role: SessionRole): boolean {
  return PLATFORM_ROLES.includes(role);
}
