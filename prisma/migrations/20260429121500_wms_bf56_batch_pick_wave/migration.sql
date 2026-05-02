-- BF-56: batch / cluster pick wave mode on WmsWave + batchGroupKey on pick tasks

CREATE TYPE "WmsWavePickMode" AS ENUM ('SINGLE_ORDER', 'BATCH');

ALTER TABLE "WmsWave" ADD COLUMN "pickMode" "WmsWavePickMode" NOT NULL DEFAULT 'SINGLE_ORDER';

ALTER TABLE "WmsTask" ADD COLUMN "batchGroupKey" VARCHAR(120);
