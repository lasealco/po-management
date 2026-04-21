/**
 * Identity of the investor demo row created by `npm run db:seed:supply-chain-twin-demo`.
 * Keep in sync with `prisma/seed-supply-chain-twin-demo.mjs`.
 */
export const SCTWIN_DEMO_SEED_ENTITY_KIND = "supplier" as const;

export const SCTWIN_DEMO_SEED_ENTITY_KEY = "DEMO-SCTWIN-SEED-SUPPLIER";

/** Demo risk row upserted by `npm run db:seed:supply-chain-twin-demo`. Keep in sync with `prisma/seed-supply-chain-twin-demo.mjs`. */
export const SCTWIN_DEMO_SEED_RISK_CODE = "DEMO-SCTWIN-SEED-RISK" as const;

/** Additional demo risk codes from `prisma/seed-supply-chain-twin-demo.mjs` (customer showcase pack). */
export const SCTWIN_DEMO_SEED_RISK_HIGH_CODE = "DEMO-SCTWIN-SEED-RISK-HIGH" as const;
export const SCTWIN_DEMO_SEED_RISK_PORT_CODE = "DEMO-SCTWIN-SEED-RISK-PORT" as const;
