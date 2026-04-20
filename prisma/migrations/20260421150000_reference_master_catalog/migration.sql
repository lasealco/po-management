-- Global reference catalogs: countries (ISO 3166-1), ocean SCACs, airlines + AWB prefixes.

CREATE TABLE "reference_countries" (
    "id" TEXT NOT NULL,
    "isoAlpha2" VARCHAR(2) NOT NULL,
    "isoAlpha3" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "regionCode" VARCHAR(16),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_countries_isoAlpha2_key" ON "reference_countries"("isoAlpha2");
CREATE UNIQUE INDEX "reference_countries_isoAlpha3_key" ON "reference_countries"("isoAlpha3");
CREATE INDEX "reference_countries_regionCode_isActive_idx" ON "reference_countries"("regionCode", "isActive");

CREATE TABLE "reference_ocean_carriers" (
    "id" TEXT NOT NULL,
    "scac" VARCHAR(4) NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_ocean_carriers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_ocean_carriers_scac_key" ON "reference_ocean_carriers"("scac");

CREATE TABLE "reference_airlines" (
    "id" TEXT NOT NULL,
    "iataCode" VARCHAR(3) NOT NULL,
    "icaoCode" VARCHAR(3),
    "awbPrefix3" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_airlines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_airlines_iataCode_key" ON "reference_airlines"("iataCode");
CREATE UNIQUE INDEX "reference_airlines_icaoCode_key" ON "reference_airlines"("icaoCode");
CREATE INDEX "reference_airlines_awbPrefix3_idx" ON "reference_airlines"("awbPrefix3");
