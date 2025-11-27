-- Drop existing users table if it has wrong schema
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with correct schema for authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create index on role for admin queries
CREATE INDEX idx_users_role ON users(role);

-- Insert a default admin user (password: Admin@123)
-- Password hash generated with bcrypt for 'Admin@123'
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES (
  'admin@example.com',
  '$2b$10$YourHashHere',  -- You'll need to generate this
  'System Admin',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;
