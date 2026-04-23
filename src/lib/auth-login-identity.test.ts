import { describe, expect, it } from "vitest";

import { resolvePasswordLoginEmail } from "./auth-login-identity";

describe("resolvePasswordLoginEmail", () => {
  it("maps bare superuser on demo-company to email", () => {
    expect(resolvePasswordLoginEmail("superuser", "demo-company")).toBe("superuser@demo-company.com");
    expect(resolvePasswordLoginEmail("SuperUser", "demo-company")).toBe("superuser@demo-company.com");
  });

  it("passes through full email", () => {
    expect(resolvePasswordLoginEmail("buyer@demo-company.com", "demo-company")).toBe("buyer@demo-company.com");
  });

  it("does not map superuser on other tenants", () => {
    expect(resolvePasswordLoginEmail("superuser", "acme-corp")).toBe("superuser");
  });
});
