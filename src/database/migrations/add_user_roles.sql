-- Add role column to users table for admin/user differentiation

-- Add role column with default 'user'
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have 'user' role if NULL
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Note: Admin users should be created using the seed script (npm run seed:admin)
-- Do not auto-promote any user to admin in migrations

COMMENT ON COLUMN users.role IS 'User role: user or admin. Admins can see all users and approve labels. Use seed script to create admin.';
