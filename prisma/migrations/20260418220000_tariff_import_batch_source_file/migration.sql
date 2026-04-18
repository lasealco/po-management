-- Preserve tariff import source file + client metadata for parsing / audit.
ALTER TABLE "import_batches" ADD COLUMN "sourceFileUrl" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "sourceMimeType" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "sourceByteSize" INTEGER;
ALTER TABLE "import_batches" ADD COLUMN "sourceMetadata" JSONB;
