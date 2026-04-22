-- AlterTable
ALTER TABLE "ApiHubStagingBatch" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "applySummary" JSONB;
