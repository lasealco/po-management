-- Composite multi-contract pricing snapshots + optional Incoterm (FOB, EXW, etc.)

ALTER TYPE "PricingSnapshotSourceType" ADD VALUE 'COMPOSITE_CONTRACT_VERSION';

ALTER TABLE "booking_pricing_snapshots" ADD COLUMN "incoterm" VARCHAR(16);
