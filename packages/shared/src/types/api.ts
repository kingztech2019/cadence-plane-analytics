// API request/response envelope types

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// Workspace connection
export interface ConnectApiKeyRequest {
  baseUrl: string;
  apiKey: string;
}

export interface ConnectOAuthCallbackRequest {
  code: string;
  state: string;
}

export interface WorkspaceConnectionResponse {
  id: string;
  workspaceSlug: string;
  baseUrl: string;
  authMethod: 'api_key' | 'oauth';
  syncStatus: string;
  lastSyncedAt: string | null;
}

// State mapping
export interface StateMappingUpdate {
  stateId: string;
  flowCategory: string;
}
