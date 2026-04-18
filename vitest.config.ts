import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/lib/invoice-audit/**/*.test.ts",
      "src/lib/booking-pricing-snapshot/**/*.test.ts",
      "src/lib/rfq/**/*.test.ts",
      "src/lib/tariff/**/*.test.ts",
      "src/app/api/tariffs/**/*.test.ts",
      "src/app/api/rfq/**/*.test.ts",
      "src/app/api/booking-pricing-snapshots/**/*.test.ts",
    ],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
