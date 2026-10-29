-- P4-05 custom bidding: wizard rows stay drafts until step 3 (Save).
ALTER TABLE "CustomBiddingAlgorithm" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
