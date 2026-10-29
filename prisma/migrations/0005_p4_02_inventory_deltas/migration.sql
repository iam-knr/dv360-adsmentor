-- P4-02. Negotiation reply and expiry times (module 13 4.3). Additive: two nullable columns on an existing table
-- that already has row level security, so no policy changes.

-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN "replyAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3);
