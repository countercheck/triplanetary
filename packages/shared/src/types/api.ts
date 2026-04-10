export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthMeResponse {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface CreateMatchRequest {
  scenarioId: string;
  numPlayers: number;
}
