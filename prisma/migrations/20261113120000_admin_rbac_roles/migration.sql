-- Additive only: existing ADMIN accounts keep their role (and every permission) until an
-- operator assigns SYSTEM_ADMIN or SELLER_ADMIN explicitly.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SELLER_ADMIN';
