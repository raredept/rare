ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

INSERT INTO "User" (
  "id",
  "name",
  "email",
  "username",
  "passwordHash",
  "role",
  "active",
  "mustChangePassword",
  "createdAt",
  "updatedAt"
)
SELECT
  'admin-second-access',
  'ADMIN 2',
  'admin-2@raredept.local',
  'ADMIN 2',
  '$2b$12$AS3XdHAO4x/MxZZn.7rTBebEv2yNKcf3.TbHrMKqgV2byWOKjrfJ2',
  'ADMIN'::"UserRole",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "User"
  WHERE LOWER(COALESCE("username", '')) = LOWER('ADMIN 2')
     OR LOWER("email") = LOWER('admin-2@raredept.local')
);
