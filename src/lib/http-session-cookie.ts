/** Cookie attributes shared by auth + demo session cookies (httpOnly, path, sameSite, secure). */
export function httpSessionBase() {
  const secure = process.env.NODE_ENV === "production";
  return {
    path: "/" as const,
    sameSite: "lax" as const,
    httpOnly: true,
    secure,
  };
}
