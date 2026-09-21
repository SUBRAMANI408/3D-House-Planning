import { apiClient } from './client';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { email: string; password: string; full_name?: string; }
export interface TokenResponse { access_token: string; token_type: string; user: UserInfo; }
export interface UserInfo { id: string; email: string; full_name?: string; }

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/login', data);
  if (response.data.access_token) {
    localStorage.setItem('access_token', response.data.access_token);
  }
  return response.data;
}

export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/register', data);
  if (response.data.access_token) {
    localStorage.setItem('access_token', response.data.access_token);
  }
  return response.data;
}

export async function getMe(): Promise<UserInfo> {
  const response = await apiClient.get<UserInfo>('/auth/me');
  return response.data;
}

export function logout(): void {
  localStorage.removeItem('access_token');
}

export function getToken(): string | null {
  return localStorage.getItem('access_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
