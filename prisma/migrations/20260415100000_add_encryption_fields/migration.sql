-- Add encryption support fields to User
ALTER TABLE "User" ADD COLUMN "encryptionSalt" TEXT;
ALTER TABLE "User" ADD COLUMN "isDataEncrypted" BOOLEAN NOT NULL DEFAULT false;
