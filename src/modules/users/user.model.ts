export interface User {
  id: number;
  email: string;
  password: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithoutPassword {
  id: number;
  email: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}
