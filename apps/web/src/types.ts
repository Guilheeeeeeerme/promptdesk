export type Role = 'root' | 'admin' | 'manager' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Company {
  id: string;
  name: string;
  createdAt?: string;
}

export interface SessionPayload {
  user: User;
  activeCompany: { id: string; name: string } | null;
}

export interface LoginResponse extends SessionPayload {
  token: string;
}

export function isPlatformRole(role: Role): boolean {
  return role === 'root' || role === 'admin';
}
