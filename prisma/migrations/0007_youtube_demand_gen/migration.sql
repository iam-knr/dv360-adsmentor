-- P4-06. Demand Gen image and carousel ads (module 09 4.6): the video of an ad becomes optional and images are listed.

-- AlterTable
ALTER TABLE "Ad" ALTER COLUMN "youtubeVideoId" DROP NOT NULL,
ADD COLUMN "imageAssetIds" TEXT[];
