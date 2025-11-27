export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name?: string;
  role?: 'user' | 'admin';
  is_active: boolean;
  created_at: Date;
  updated_at?: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  name?: string;
  role?: 'user' | 'admin';
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role?: string;
}
